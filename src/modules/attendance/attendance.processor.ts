import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceJobStatusService } from './attendance-job-status.service';
import { AttendanceJobStatus } from './entities/attendance-job.entity';
import {
  AttendanceJobData,
  AttendanceJobResult,
} from './interfaces/attendance-job.interface';

@Processor('attendance')
export class AttendanceProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(AttendanceProcessor.name);
  private isInitialized = false;

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly jobStatusService: AttendanceJobStatusService,
  ) {
    super();
    // Initialize worker lazily - only log when first job arrives
    this.logger.log('AttendanceProcessor registered - will start processing when jobs are available');
  }

  async onModuleInit() {
    try {
      this.isInitialized = true;
      this.logger.log('✅ Background Worker started - ready to process attendance jobs');
    } catch (error) {
      this.logger.warn(`⚠️ Worker initialization warning: ${error.message}. Worker may not be available if Redis is not connected.`);
    }
  }

  async process(
    job: Job<AttendanceJobData>,
  ): Promise<AttendanceJobResult> {
    const { eventRepetitionId, authToken, userId } = job.data;
    const jobId = job.id!;

    this.logger.log(
      `Processing attendance job ${jobId} for event ${eventRepetitionId}`,
    );

    try {
      // Update job status to processing
      await this.jobStatusService.updateJobStatus(
        jobId,
        AttendanceJobStatus.PROCESSING,
        0,
      );

      // Process event with progress updates
      const result = await this.attendanceService.processEventWithProgress(
        eventRepetitionId,
        authToken,
        userId,
        async (progress: number) => {
          // Update progress callback
          await this.jobStatusService.updateJobStatus(
            jobId,
            AttendanceJobStatus.PROCESSING,
            progress,
          );
          await job.updateProgress(progress);
        },
      );

      // Mark job as completed
      await this.jobStatusService.updateJobStatus(
        jobId,
        AttendanceJobStatus.COMPLETED,
        100,
        undefined,
        result,
      );

      this.logger.log(
        `Completed attendance job ${jobId}: ${result.participantsAttended} participants marked as attended`,
      );

      return result;
    } catch (error: any) {
      this.logger.error(
        `Failed to process attendance job ${jobId}: ${error.message}`,
        error.stack,
      );

      // Mark job as failed
      await this.jobStatusService.updateJobStatus(
        jobId,
        AttendanceJobStatus.FAILED,
        undefined,
        error.message,
      );

      throw error; // Re-throw to trigger BullMQ retry mechanism
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}

