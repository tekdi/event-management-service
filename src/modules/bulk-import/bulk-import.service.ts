import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AttendanceJob, AttendanceJobStatus } from '../attendance/entities/attendance-job.entity';
import { v4 as uuidv4, validate as isUuid } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

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
    eventRepetitionId: string,
    adminUserId: string,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException('No file uploaded or file field name is incorrect (should be "file")');
    }

    const internalId = uuidv4();
    const fileName = `${internalId}-${file.originalname}`;
    const filePath = path.join(this.uploadDir, fileName);

    // Save file locally
    fs.writeFileSync(filePath, file.buffer);

    // Create AttendanceJob record first to avoid race condition with worker
    const attendanceJob = this.attendanceJobRepository.create({
      id: internalId,
      jobId: 'pending', // Will be updated after enqueuing
      eventRepetitionId: eventRepetitionId || null,
      contextType: 'bulk-import',
      status: AttendanceJobStatus.PENDING,
      progress: 0,
      result: {
        importType: 'attendance',
        adminUserId,
        eventId,
        originalFileName: file.originalname,
        filePath,
        successCount: 0,
        failureCount: 0,
        totalCount: 0,
      },
    });

    await this.attendanceJobRepository.save(attendanceJob);

    // Enqueue job for background processing with a custom ID
    // Enqueue job for background processing with a simplified custom ID
    const customJobId = `bulk-import/${eventRepetitionId || eventId}`;
    const bullJob = await this.bulkImportQueue.add('process-attendance-import', {
      internalId,
      eventId,
      eventRepetitionId,
      filePath,
      adminUserId,
    }, { jobId: customJobId });

    // Update job record with our custom jobId
    await this.attendanceJobRepository.update(internalId, { jobId: customJobId });

    this.logger.log(`Enqueued bulk import job ${bullJob.id} for event ${eventRepetitionId || eventId}`);

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
