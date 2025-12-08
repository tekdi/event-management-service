import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AttendanceJobData } from './interfaces/attendance-job.interface';

@Injectable()
export class AttendanceQueueService {
  private readonly logger = new Logger(AttendanceQueueService.name);

  constructor(
    @InjectQueue('attendance')
    private readonly attendanceQueue: Queue<AttendanceJobData>,
  ) {}

  async createJob(data: AttendanceJobData) {
    try {
      const job = await this.attendanceQueue.add('process-attendance', data, {
        jobId: `attendance-${data.eventRepetitionId}-${Date.now()}`,
      });
      return job;
    } catch (error: any) {
      this.logger.error(`Failed to create attendance job: ${error.message}`);
      // Re-throw to let controller handle the error
      throw error;
    }
  }

  async getJob(jobId: string) {
    try {
      return await this.attendanceQueue.getJob(jobId);
    } catch (error: any) {
      this.logger.error(`Failed to get job ${jobId}: ${error.message}`);
      return null;
    }
  }

  async getJobs(
    status?: 'active' | 'completed' | 'failed' | 'waiting' | 'delayed',
    limit: number = 50,
  ) {
    try {
      if (status) {
        return await this.attendanceQueue.getJobs([status], 0, limit - 1);
      }
      return await this.attendanceQueue.getJobs(
        ['active', 'completed', 'failed', 'waiting'],
        0,
        limit - 1,
      );
    } catch (error: any) {
      this.logger.error(`Failed to get jobs: ${error.message}`);
      return [];
    }
  }
}

