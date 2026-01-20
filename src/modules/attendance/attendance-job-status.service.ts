import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AttendanceJob,
  AttendanceJobStatus,
} from './entities/attendance-job.entity';

@Injectable()
export class AttendanceJobStatusService {
  private readonly logger = new Logger(AttendanceJobStatusService.name);

  constructor(
    @InjectRepository(AttendanceJob)
    private readonly attendanceJobRepository: Repository<AttendanceJob>,
  ) {}

  async createJob(
    jobId: string,
    eventRepetitionId?: string,
  ): Promise<AttendanceJob> {
    const job = this.attendanceJobRepository.create({
      jobId,
      eventRepetitionId,
      status: AttendanceJobStatus.PENDING,
      progress: 0,
    });
    return this.attendanceJobRepository.save(job);
  }

  async updateJobStatus(
    jobId: string,
    status: AttendanceJobStatus,
    progress?: number,
    errorMessage?: string,
    result?: any,
  ): Promise<void> {
    const updateData: any = { status };

    if (progress !== undefined) {
      updateData.progress = progress;
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    if (result) {
      updateData.result = result;
    }

    // Set startedAt when status changes to PROCESSING (only if not already set)
    if (status === AttendanceJobStatus.PROCESSING) {
      // Check if startedAt is already set in database
      const existingJob = await this.attendanceJobRepository.findOne({
        where: { jobId },
        select: ['startedAt'],
      });
      
      if (!existingJob?.startedAt) {
        updateData.startedAt = new Date();
        this.logger.log(`⏰ Setting started_at for job ${jobId} to ${updateData.startedAt.toISOString()}`);
      } else {
        this.logger.debug(`⏰ Job ${jobId} already has started_at: ${existingJob.startedAt}`);
      }
    }

    if (
      status === AttendanceJobStatus.COMPLETED ||
      status === AttendanceJobStatus.FAILED
    ) {
      updateData.completedAt = new Date();
    }

    await this.attendanceJobRepository.update({ jobId }, updateData);
  }

  async getJobByJobId(jobId: string): Promise<AttendanceJob | null> {
    return this.attendanceJobRepository.findOne({ where: { jobId } });
  }

  async getJobs(
    status?: AttendanceJobStatus,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ jobs: AttendanceJob[]; total: number }> {
    const queryBuilder =
      this.attendanceJobRepository.createQueryBuilder('job');

    if (status) {
      queryBuilder.where('job.status = :status', { status });
    }

    queryBuilder
      .orderBy('job.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    const [jobs, total] = await queryBuilder.getManyAndCount();

    return { jobs, total };
  }
}

