import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AttendanceJob,
  AttendanceJobStatus,
} from './entities/attendance-job.entity';

@Injectable()
export class AttendanceJobStatusService {
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

    if (
      status === AttendanceJobStatus.PROCESSING &&
      !updateData.startedAt
    ) {
      updateData.startedAt = new Date();
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

