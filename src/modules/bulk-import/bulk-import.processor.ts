import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceJob, AttendanceJobStatus } from '../attendance/entities/attendance-job.entity';
import { EventAttendees } from '../attendees/entity/attendees.entity';
import { LmsService } from '../lms/lms.service';
import { UserService } from '../user/user.service';
import { KafkaService } from '../../kafka/kafka.service';
import { ConfigService } from '@nestjs/config';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import { validate as isUuid } from 'uuid';

@Processor('bulk-import')
export class BulkImportProcessor extends WorkerHost {
  private readonly logger = new Logger(BulkImportProcessor.name);
  private readonly batchSize: number;

  constructor(
    @InjectRepository(AttendanceJob)
    private readonly attendanceJobRepository: Repository<AttendanceJob>,
    @InjectRepository(EventAttendees)
    private readonly eventAttendeesRepository: Repository<EventAttendees>,
    private readonly lmsService: LmsService,
    private readonly userService: UserService,
    private readonly kafkaService: KafkaService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.batchSize = this.configService.get<number>('BULK_IMPORT_BATCH_SIZE', 50);
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { internalId, eventId, eventRepetitionId, filePath, adminUserId } = job.data;
    const jobId = job.id;
    
    this.logger.log(`Processing bulk import job ${jobId} (Internal ID: ${internalId})`);
    
    const attendanceJob = await this.attendanceJobRepository.findOne({ where: { id: internalId } });
    if (!attendanceJob) {
      this.logger.error(`Attendance job ${internalId} not found in database`);
      return;
    }

    const validAdminUserId = isUuid(adminUserId) ? adminUserId : null;

    try {
      const resultData = attendanceJob.result || {};
      resultData.failures = []; 
      
      await this.attendanceJobRepository.update(internalId, { 
        status: AttendanceJobStatus.PROCESSING, 
        startedAt: new Date(),
        completedAt: null 
      });

      // Load workbook asynchronously to avoid blocking I/O
      const buffer = await fs.promises.readFile(filePath);
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = xlsx.utils.sheet_to_json(sheet);

      resultData.totalCount = rows.length;
      await this.attendanceJobRepository.update(internalId, { result: resultData });

      // Step 1: Resolve userIds from emails
      this.logger.log(`Resolving userIds for ${rows.length} rows using batch size ${this.batchSize}...`);
      const uniqueEmails = Array.from(new Set(
        rows.map(row => (row.emailId || row.Email || row.email)?.toLowerCase()).filter(Boolean)
      ));
      
      const emailToUserIdMap = await this.userService.getUserIdsFromEmails(uniqueEmails);
      this.logger.log(`Resolved ${emailToUserIdMap.size} userIds from ${uniqueEmails.length} unique emails.`);

      let successCount = 0;
      let failureCount = 0;

      // Step 2: Process attendance marking
      for (let i = 0; i < rows.length; i += this.batchSize) {
        const batch = rows.slice(i, i + this.batchSize);

        // Pre-fetch all EventAttendees for this batch
        const whereConditions = batch.map(row => {
          const email = (row.emailId || row.Email || row.email)?.toLowerCase();
          let targetUserId = row.userId || row.UserId || row.userid;
          if (!targetUserId && email) targetUserId = emailToUserIdMap.get(email);
          const condition: any = {
            eventId: row.eventId || row.EventId || eventId,
            userId: targetUserId
          };
          const repId = row.eventRepetitionId || row.EventRepetitionId || eventRepetitionId;
          if (repId) {
            condition.eventRepetitionId = repId;
          }
          return condition;
        }).filter(c => c.userId);

        const attendees = await this.eventAttendeesRepository.find({
          where: whereConditions
        });

        // Build a lookup map for the batch grouped by eventId and userId
        const attendeeMap = new Map<string, EventAttendees[]>();
        for (const attendee of attendees) {
          const key = `${attendee.eventId}-${attendee.userId}`;
          if (!attendeeMap.has(key)) {
            attendeeMap.set(key, []);
          }
          attendeeMap.get(key)!.push(attendee);
        }

        for (let j = 0; j < batch.length; j++) {
          const row = batch[j];
          const identifier = (row.emailId || row.Email || row.email) || (row.userId || row.UserId || row.userid) || `Row ${i + j + 1}`;
          
          try {
            const email = (row.emailId || row.Email || row.email)?.toLowerCase();
            let targetUserId = row.userId || row.UserId || row.userid;
            const duration = row.duration || row.Duration || 0;
            const rowEventId = row.eventId || row.EventId || eventId;
            const rowEventRepetitionId = row.eventRepetitionId || row.EventRepetitionId || eventRepetitionId || null;

            if (!targetUserId && email) {
              targetUserId = emailToUserIdMap.get(email);
            }

            if (!targetUserId) {
              throw new Error(`Could not resolve userId for email: ${email || 'N/A'}`);
            }

            const lookupKey = `${rowEventId}-${targetUserId}`;
            const attendeeMatches = attendeeMap.get(lookupKey) || [];
            
            let attendee: EventAttendees | undefined;
            
            if (rowEventRepetitionId) {
              // If repetition ID is provided, find the exact match
              attendee = attendeeMatches.find(a => a.eventRepetitionId === rowEventRepetitionId);
            } else if (attendeeMatches.length > 0) {
              // If no repetition ID is provided, but we found records, use the first one
              attendee = attendeeMatches[0];
            }

            if (!attendee) {
              throw new Error(`No attendance record found for event ${rowEventId} and user ${targetUserId} (${email || 'no email'})`);
            }

            attendee.isAttended = true;
            attendee.duration = duration;
            attendee.updatedAt = new Date();
            attendee.updatedBy = validAdminUserId;
            await this.eventAttendeesRepository.save(attendee);

            try {
              await this.lmsService.markLessonCompletionWithRetry(rowEventId, targetUserId, duration);
              successCount++;
            } catch (lmsError) {
              failureCount++;
              resultData.failures.push({
                identifier,
                errorMessage: `Attendance marked, but LMS completion failed: ${lmsError.message}`,
                errorType: 'LMS_SYNC_FAILURE',
                timestamp: new Date().toISOString()
              });
            }

          } catch (error) {
            failureCount++;
            resultData.failures.push({
              identifier,
              errorMessage: error.message,
              errorType: 'ATTENDANCE_MARKING_FAILURE',
              timestamp: new Date().toISOString()
            });
          }
        }

        const progress = Math.round(((i + batch.length) / rows.length) * 100);
        resultData.successCount = successCount;
        resultData.failureCount = failureCount;
        
        await this.attendanceJobRepository.update(internalId, {
          progress,
          result: resultData,
        });

        await this.kafkaService.publishMessage('import-progress', {
          jobId,
          internalId,
          successCount,
          failureCount,
          progress,
          status: 'processing',
        });
      }

      const finalStatus = (successCount === 0 && rows.length > 0) 
        ? AttendanceJobStatus.FAILED 
        : AttendanceJobStatus.COMPLETED;

      await this.attendanceJobRepository.update(internalId, {
        status: finalStatus,
        completedAt: new Date(),
        progress: 100,
        result: resultData,
      });

      await this.kafkaService.publishMessage('import-progress', {
        jobId,
        internalId,
        successCount,
        failureCount,
        status: finalStatus === AttendanceJobStatus.FAILED ? 'failed' : 'completed',
      });

      this.logger.log(`Bulk import job ${jobId} finished with status ${finalStatus}. Success: ${successCount}, Failures: ${failureCount}`);

    } catch (error) {
      this.logger.error(`Failed to process import job ${jobId}`, error);
      await this.attendanceJobRepository.update(internalId, {
        status: AttendanceJobStatus.FAILED,
        completedAt: new Date(),
        errorMessage: error.message,
      });
    } finally {
      if (fs.existsSync(filePath)) {
        try {
          await fs.promises.unlink(filePath);
        } catch (err) {
          this.logger.error(`Failed to delete temporary file ${filePath}`, err);
        }
      }
    }
  }
}
