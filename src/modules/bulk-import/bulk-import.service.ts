import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AttendanceJob, AttendanceJobStatus } from '../attendance/entities/attendance-job.entity';
import { v4 as uuidv4, validate as isUuid } from 'uuid';
import * as fs from 'node:fs';
import * as path from 'node:path';

@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);
  private readonly uploadDir = path.join(process.cwd(), 'data', 'import-xlsx');

  constructor(
    @InjectRepository(AttendanceJob)
    private readonly attendanceJobRepository: Repository<AttendanceJob>,
    @InjectQueue('bulk-import')
    private readonly bulkImportQueue: Queue,
  ) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async handleFileUpload(
    file: Express.Multer.File,
    eventId: string,
    cohortId: string,
    lessonId: string,
    courseId: string,
    adminUserId: string,
    requestContext?: {
      tenantid?: string;
      academicyearid?: string;
      authorization?: string;
    },
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException('No file uploaded or file field name is incorrect (should be "file")');
    }

    const internalId = uuidv4();
    const ext = path.extname(file.originalname);
    const fileName = `${internalId}${ext}`;
    const filePath = path.join(this.uploadDir, fileName);

    // Save file locally (asynchronously)
    await fs.promises.writeFile(filePath, file.buffer);

    const baseJobId = `bulk-import/${eventId}`;
    const customJobId = `${baseJobId}-${Date.now()}`;

    // Prevent concurrent imports for the same event by checking the database
    const activeJobsCount = await this.attendanceJobRepository.count({
      where: {
        jobId: Like(`${baseJobId}%`),
        status: In([AttendanceJobStatus.PENDING, AttendanceJobStatus.PROCESSING]),
      }
    });

    if (activeJobsCount > 0) {
      throw new BadRequestException('An import is already in progress for this event.');
    }

    // Create AttendanceJob record first to avoid race condition with worker
    const attendanceJob = this.attendanceJobRepository.create({
      id: internalId,
      jobId: customJobId, 
      eventRepetitionId: null, // Removed eventRepetitionId as per requirement
      contextType: 'bulk-import',
      status: AttendanceJobStatus.PENDING,
      progress: 0,
      result: {
        importType: 'attendance',
        adminUserId,
        eventId,
        cohortId,
        lessonId,
        courseId,
        requestContext: {
          tenantid: requestContext?.tenantid ?? null,
          academicyearid: requestContext?.academicyearid ?? null,
          hasAuth: Boolean(requestContext?.authorization),
        },
        originalFileName: file.originalname,
        filePath,
        successCount: 0,
        failureCount: 0,
        totalCount: 0,
      },
    });

    await this.attendanceJobRepository.save(attendanceJob);

    // Enqueue job for background processing
    const bullJob = await this.bulkImportQueue.add('process-attendance-import', {
      internalId,
      eventId,
      cohortId,
      lessonId,
      courseId,
      filePath,
      adminUserId,
      requestContext: {
        tenantid: requestContext?.tenantid,
        academicyearid: requestContext?.academicyearid,
        authorization: requestContext?.authorization,
      },
    }, { jobId: customJobId });

    this.logger.log(`Enqueued bulk import job ${bullJob.id} for event ${eventId}`);

    return {
      jobId: bullJob.id,
      id: internalId,
      status: 'pending',
      message: 'Import job created and enqueued for background processing',
    };
  }

  async getImportJobStatus(idOrJobId: string): Promise<any> {
    let job: AttendanceJob;

    // Safely check if it's a UUID before querying the 'id' column
    if (idOrJobId && isUuid(idOrJobId)) {
      job = await this.attendanceJobRepository.findOne({ where: { id: idOrJobId } });
    }

    // If not found by UUID, search by BullMQ jobId (which is a string, e.g., "1")
    if (!job) {
      job = await this.attendanceJobRepository.findOne({ where: { jobId: idOrJobId } });
    }

    if (!job) {
      throw new NotFoundException(`Import job with ID ${idOrJobId} not found`);
    }

    return {
      jobId: job.jobId,
      id: job.id,
      status: job.status,
      progress: job.progress,
      errorMessage: job.errorMessage,
      stats: job.result,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };
  }
}
