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
import { EventRepetition } from '../event/entities/eventRepetition.entity';
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
    @InjectRepository(EventRepetition)
    private readonly eventRepetitionRepository: Repository<EventRepetition>,
    private readonly lmsService: LmsService,
    private readonly userService: UserService,
    private readonly kafkaService: KafkaService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.batchSize = this.configService.get<number>('BULK_IMPORT_BATCH_SIZE', 50);
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { internalId, eventId, cohortId, lessonId, courseId, filePath, adminUserId } = job.data;
    const jobId = job.id;
    
    this.logger.log(`[BullMQ] Starting bulk import job ${jobId} (Internal ID: ${internalId}). Monitoring progress via Kafka.`);
    
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

      // Step 0: Resolve eventRepetitionId
      const eventRepetition = await this.eventRepetitionRepository.findOne({
        where: { eventId: eventId }
      });

      if (!eventRepetition) {
        throw new Error(`Event repetition not found for eventId: ${eventId}`);
      }

      const eventRepetitionId = eventRepetition.eventRepetitionId;

      // Load workbook asynchronously
      const buffer = await fs.promises.readFile(filePath);
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = xlsx.utils.sheet_to_json(sheet);

      resultData.totalCount = rows.length;
      await this.attendanceJobRepository.update(internalId, { result: resultData });

      // Step 1: Resolve userIds from emails
      const uniqueEmails = Array.from(new Set(
        rows.map(row => (row.emailId || row.Email || row.email)?.toLowerCase()).filter(Boolean)
      ));
      
      const emailToUserIdMap = await this.userService.getUserIdsFromEmails(uniqueEmails);

      let successCount = 0;
      let failureCount = 0;

      // Step 2: Process attendance marking in batches
      for (let i = 0; i < rows.length; i += this.batchSize) {
        const batch = rows.slice(i, i + this.batchSize);

        // Pre-fetch all EventAttendees for this batch
        const whereConditions = batch.map(row => {
          const email = (row.emailId || row.Email || row.email)?.toLowerCase();
          let targetUserId = row.userId || row.UserId || row.userid;
          if (!targetUserId && email) targetUserId = emailToUserIdMap.get(email);
          return {
            eventId: eventId,
            userId: targetUserId
          };
        }).filter(c => c.userId);

        const attendees = await this.eventAttendeesRepository.find({
          where: whereConditions
        });

        // Build a lookup map for the batch
        const attendeeMap = new Map<string, EventAttendees>();
        for (const attendee of attendees) {
          attendeeMap.set(attendee.userId, attendee);
        }

        const batchAttendeesToSave: EventAttendees[] = [];
        const rowProcessingPromises = batch.map(async (row, j) => {
          const identifier = (row.emailId || row.Email || row.email) || (row.userId || row.UserId || row.userid) || `Row ${i + j + 1}`;
          
          try {
            const email = (row.emailId || row.Email || row.email)?.toLowerCase();
            let targetUserId = row.userId || row.UserId || row.userid;
            const duration = row.duration || row.Duration || 0;

            // Step 1: Check if user exists
            if (!targetUserId && email) {
              targetUserId = emailToUserIdMap.get(email);
            }

            if (!targetUserId) {
              throw new Error(`user email not exist`);
            }

            // Step 2: Check shortlisting using cohortId from payload
            if (cohortId) {
              const isShortlisted = await this.userService.checkCohortShortlisted(targetUserId, cohortId);
              if (!isShortlisted) {
                throw new Error(`user status is not shortlisted`);
              }
            }

            // Step 3: Check LMS course enrollment (Required - no auto-enrollment)
            if (courseId) {
              const isEnrolled = await this.lmsService.checkEnrollment(targetUserId, courseId);
              if (!isEnrolled) {
                throw new Error(`user is not enrolled`);
              }
            }

            // Step 4: Check/Create EventAttendee record (Event Enrollment)
            let attendee = attendeeMap.get(targetUserId);

            if (!attendee) {
              attendee = this.eventAttendeesRepository.create({
                eventId: eventId,
                eventRepetitionId: eventRepetitionId,
                userId: targetUserId,
                isAttended: true,
                duration: duration,
                enrolledAt: new Date(),
                enrolledBy: validAdminUserId,
                status: 'published',
                joinedLeftHistory: [],
                params: {},
                updatedAt: new Date(),
                updatedBy: validAdminUserId,
              });
            } else {
              attendee.isAttended = true;
              attendee.duration = duration;
              attendee.status = 'published';
              attendee.eventRepetitionId = eventRepetitionId;
              attendee.joinedLeftHistory = attendee.joinedLeftHistory || [];
              attendee.params = attendee.params || {};
              attendee.updatedAt = new Date();
              attendee.updatedBy = validAdminUserId;
            }
            
            batchAttendeesToSave.push(attendee);

            // Step 5: Check and handle LMS lesson track & completion
            try {
              if (lessonId) {
                // Ensure lesson track exists before marking completion (LMS Enrollment)
                // We run this for both new and existing attendees to ensure data integrity
                const trackExists = await this.lmsService.checkLessontrack(lessonId, targetUserId);
                if (!trackExists) {
                  await this.lmsService.markLessonAttempt(lessonId, targetUserId);
                }
              }

              await this.lmsService.markLessonCompletionWithRetry(eventId, targetUserId, duration);
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
        });

        // Parallel processing of network calls
        await Promise.all(rowProcessingPromises);

        // Batch database save
        if (batchAttendeesToSave.length > 0) {
          await this.eventAttendeesRepository.save(batchAttendeesToSave);
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
      this.logger.log(`[BullMQ] Finishing bulk import job ${jobId}. Clearing local metadata cache and deleting temporary file.`);
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
