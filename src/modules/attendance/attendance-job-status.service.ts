import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AttendanceJob,
  AttendanceJobStatus,
} from './entities/attendance-job.entity';
import { EventRepetition } from '../event/entities/eventRepetition.entity';

export type AttendanceJobStatusEnriched = {
  job: AttendanceJob;
  eventName: string | null;
  attendanceMarked: boolean | null;
  eventRepetition: Record<string, unknown> | null;
};

/** Job row for list APIs: same as AttendanceJob plus event title (EventDetails.title). */
export type AttendanceJobListItem = AttendanceJob & {
  eventName: string | null;
};

@Injectable()
export class AttendanceJobStatusService {
  private readonly logger = new Logger(AttendanceJobStatusService.name);

  constructor(
    @InjectRepository(AttendanceJob)
    private readonly attendanceJobRepository: Repository<AttendanceJob>,
    @InjectRepository(EventRepetition)
    private readonly eventRepetitionRepository: Repository<EventRepetition>,
  ) {}

  async createJob(
    jobId: string,
    eventRepetitionId?: string,
    contextType?: string | null,
  ): Promise<AttendanceJob> {
    const job = this.attendanceJobRepository.create({
      jobId,
      eventRepetitionId,
      contextType: contextType ?? null,
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

  /**
   * Job status with EventRepetition context (event title, attendanceMarked).
   * If filterEventRepetitionId is set, returns null when the job is not for that repetition.
   */
  async getJobStatusEnriched(
    jobId: string,
    filterEventRepetitionId?: string,
  ): Promise<AttendanceJobStatusEnriched | null> {
    const job = await this.getJobByJobId(jobId);
    if (!job) {
      return null;
    }
    if (
      filterEventRepetitionId &&
      job.eventRepetitionId !== filterEventRepetitionId
    ) {
      return null;
    }

    if (!job.eventRepetitionId) {
      return {
        job,
        eventName: null,
        attendanceMarked: null,
        eventRepetition: null,
      };
    }

    const er = await this.eventRepetitionRepository.findOne({
      where: { eventRepetitionId: job.eventRepetitionId },
      relations: ['event', 'event.eventDetail'],
    });

    const eventName = er?.event?.eventDetail?.title ?? null;
    const attendanceMarked = er ? er.attendanceMarked : null;

    const eventRepetition = er
      ? {
          eventRepetitionId: er.eventRepetitionId,
          eventId: er.eventId,
          eventDetailId: er.eventDetailId,
          onlineDetails: er.onlineDetails,
          erMetaData: er.erMetaData,
          params: er.params,
          startDateTime: er.startDateTime,
          endDateTime: er.endDateTime,
          createdAt: er.createdAt,
          updatedAt: er.updatedAt,
          createdBy: er.createdBy,
          updatedBy: er.updatedBy,
          attendanceMarked: er.attendanceMarked,
          totalParticipantsProcessed: er.totalParticipantsProcessed,
          totalParticipantsExpected: er.totalParticipantsExpected,
        }
      : null;

    return { job, eventName, attendanceMarked, eventRepetition };
  }

  /**
   * Batch-load event titles (EventDetails.title) for jobs — one query for all repetition ids.
   */
  private async attachEventNamesToJobs(
    jobs: AttendanceJob[],
  ): Promise<AttendanceJobListItem[]> {
    const repIds = [
      ...new Set(
        jobs
          .map((j) => j.eventRepetitionId)
          .filter((id): id is string => !!id),
      ),
    ];

    if (repIds.length === 0) {
      return jobs.map(
        (j) =>
          ({ ...j, eventName: null }) as AttendanceJobListItem,
      );
    }

    const repetitions = await this.eventRepetitionRepository.find({
      where: { eventRepetitionId: In(repIds) },
      relations: ['event', 'event.eventDetail'],
    });

    const titleByRepId = new Map<string, string | null>();
    for (const er of repetitions) {
      titleByRepId.set(
        er.eventRepetitionId,
        er.event?.eventDetail?.title ?? null,
      );
    }

    return jobs.map((job) => {
      const eventName = job.eventRepetitionId
        ? titleByRepId.get(job.eventRepetitionId) ?? null
        : null;
      return { ...job, eventName } as AttendanceJobListItem;
    });
  }

  async getJobs(
    status?: AttendanceJobStatus,
    limit: number = 50,
    offset: number = 0,
    eventRepetitionId?: string,
    contextType?: string,
  ): Promise<{ jobs: AttendanceJobListItem[]; total: number }> {
    const queryBuilder =
      this.attendanceJobRepository.createQueryBuilder('job');

    const clauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (status !== undefined) {
      clauses.push('job.status = :status');
      params.status = status;
    }
    if (eventRepetitionId) {
      clauses.push('job.eventRepetitionId = :eventRepetitionId');
      params.eventRepetitionId = eventRepetitionId;
    }
    if (contextType !== undefined) {
      clauses.push('job.contextType = :contextType');
      params.contextType = contextType;
    }

    if (clauses.length > 0) {
      queryBuilder.where(clauses.join(' AND '), params);
    }

    queryBuilder
      .orderBy('job.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    const [jobs, total] = await queryBuilder.getManyAndCount();
    const jobsWithTitles = await this.attachEventNamesToJobs(jobs);

    return { jobs: jobsWithTitles, total };
  }
}

