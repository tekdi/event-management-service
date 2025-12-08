import {
  Body,
  Controller,
  Post,
  Res,
  Req,
  UseFilters,
  UsePipes,
  ValidationPipe,
  UnauthorizedException,
  Get,
  Param,
  Query,
  NotFoundException,
  InternalServerErrorException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import {
  ApiBasicAuth,
  ApiBody,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { AttendanceQueueService } from './attendance-queue.service';
import { AttendanceJobStatusService } from './attendance-job-status.service';
import { AllExceptionsFilter } from 'src/common/filters/exception.filter';
import {
  MarkMeetingAttendanceDto,
  MarkAttendanceByUsernameDto,
  MarkAttendanceDto,
} from './dto/markAttendance.dto';
import { API_ID } from 'src/common/utils/constants.util';
import { GetUserId } from 'src/common/decorators/userId.decorator';
import APIResponse from 'src/common/utils/response';
import { AttendanceJobStatus } from './entities/attendance-job.entity';
import { Logger } from '@nestjs/common';

@Controller('attendance/v1')
@ApiTags('Event-Attendance')
@ApiBasicAuth('access-token')
export class EventAttendance {
  private readonly logger = new Logger(EventAttendance.name);

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly attendanceQueueService: AttendanceQueueService,
    private readonly jobStatusService: AttendanceJobStatusService,
  ) {}

  @UseFilters(new AllExceptionsFilter(API_ID.MARK_EVENT_ATTENDANCE))
  @Post('/markeventattendance')
  @ApiBody({ type: MarkMeetingAttendanceDto })
  @UsePipes(new ValidationPipe({ transform: true }))
  async markEventAttendance(
    @Body() markZoomAttendanceDto: MarkMeetingAttendanceDto,
    @Res() response: Response,
    @Req() request: Request,
    @GetUserId() userId: string,
  ): Promise<Response> {
    if (!request?.headers?.authorization) {
      throw new UnauthorizedException('Unauthorized');
    }
    const token = request.headers.authorization;
    return this.attendanceService.markAttendanceForMeetingParticipants(
      markZoomAttendanceDto,
      userId,
      response,
      token,
    );
  }

  /**
   * Mark attendance for a meeting participants (Queue-based)
   * Creates background jobs for processing attendance marking
   * Supports both single event and bulk processing
   * @param dto - DTO containing optional eventRepetitionId
   * @param response - Response object
   * @param request - Request object
   * @param userId - User ID
   * @returns Response object with job IDs
   */
  @UseFilters(new AllExceptionsFilter(API_ID.MARK_ATTENDANCE))
  @Post('/mark-attendance')
  @ApiBody({ type: MarkAttendanceDto })
  @UsePipes(new ValidationPipe({ transform: true }))
  async markAttendance(
    @Body() dto: MarkAttendanceDto,
    @Res() response: Response,
    @Req() request: Request,
    @GetUserId() userId: string,
  ): Promise<Response> {
    if (!request?.headers?.authorization) {
      throw new UnauthorizedException('Unauthorized');
    }
    const authToken =
      request.headers.authorization?.replace('Bearer ', '') ||
      request.headers.authorization ||
      '';

    try {
      let jobIds: string[] = [];

      if (dto.eventRepetitionId) {
        // Process single event
        const job = await this.attendanceQueueService.createJob({
          eventRepetitionId: dto.eventRepetitionId,
          authToken,
          userId,
        });

        await this.jobStatusService.createJob(job.id!, dto.eventRepetitionId);
        jobIds = [job.id!];

        this.logger.log(
          `Created attendance job ${job.id} for event ${dto.eventRepetitionId}`,
        );
      } else {
        // Process all ended events (existing cron logic)
        const endedEvents =
          await this.attendanceService.getEndedEventsNotMarked();

        for (const event of endedEvents) {
          const job = await this.attendanceQueueService.createJob({
            eventRepetitionId: event.eventRepetitionId,
            authToken,
          });

          await this.jobStatusService.createJob(
            job.id!,
            event.eventRepetitionId,
          );
          jobIds.push(job.id!);
        }

        this.logger.log(
          `Created ${jobIds.length} attendance jobs for ended events`,
        );
      }

      return response.status(HttpStatus.ACCEPTED).json(
        APIResponse.success(
          API_ID.MARK_ATTENDANCE,
          {
            jobIds,
            totalEvents: jobIds.length,
            status: 'pending',
            message:
              'Attendance marking jobs created. Use status API to track progress.',
          },
          'Attendance marking job(s) created',
        ),
      );
    } catch (error: any) {
      this.logger.error(`Failed to create attendance job: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to create attendance job: ${error.message}`,
      );
    }
  }

  /**
   * Get job status by job ID
   * @param jobId - Job ID
   * @param response - Response object
   * @returns Response object with job status
   */
  @Get('/status/:jobId')
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  async getStatus(
    @Param('jobId') jobId: string,
    @Res() response: Response,
  ): Promise<Response> {
    try {
      const job = await this.jobStatusService.getJobByJobId(jobId);

      if (!job) {
        throw new NotFoundException(`Job ${jobId} not found`);
      }

      // Also get BullMQ job status
      const bullJob = await this.attendanceQueueService.getJob(jobId);
      const bullJobState = await bullJob?.getState();

      return response.status(HttpStatus.OK).json(
        APIResponse.success(
          API_ID.MARK_ATTENDANCE,
          {
            jobId: job.jobId,
            eventRepetitionId: job.eventRepetitionId,
            status: job.status,
            progress: job.progress,
            errorMessage: job.errorMessage,
            result: job.result,
            bullJobState,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
          },
          'Job status retrieved',
        ),
      );
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get job status: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to get job status: ${error.message}`,
      );
    }
  }

  /**
   * Get list of jobs with optional filtering
   * @param status - Optional status filter
   * @param limit - Number of jobs to return
   * @param offset - Offset for pagination
   * @param response - Response object
   * @returns Response object with jobs list
   */
  @Get('/jobs')
  @ApiQuery({ name: 'status', required: false, enum: AttendanceJobStatus })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getJobs(
    @Res() response: Response,
    @Query('status') status?: AttendanceJobStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<Response> {
    try {
      const { jobs, total } = await this.jobStatusService.getJobs(
        status,
        limit || 50,
        offset || 0,
      );

      return response.status(HttpStatus.OK).json(
        APIResponse.success(
          API_ID.MARK_ATTENDANCE,
          {
            jobs,
            total,
            limit: limit || 50,
            offset: offset || 0,
          },
          'Jobs retrieved',
        ),
      );
    } catch (error: any) {
      this.logger.error(`Failed to get jobs: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to get jobs: ${error.message}`,
      );
    }
  }

  /**
   * Mark attendance by userId directly (without Zoom API)
   * This API is designed for Postman runner testing and manual attendance marking
   * It skips Zoom API calls and User Service lookup, directly processes userIds to mark attendance
   * 
   * @param markAttendanceByUsernameDto - DTO containing userIds and event details
   * @param response - Response object
   * @param request - Request object
   * @param userId - User ID of the person marking attendance
   * @returns Response object with attendance marking results
   */
  @UseFilters(new AllExceptionsFilter(API_ID.MARK_ATTENDANCE_BY_USERNAME))
  @Post('/mark-attendance-by-userId')
  @ApiBody({ type: MarkAttendanceByUsernameDto })
  @UsePipes(new ValidationPipe({ transform: true }))
  async markAttendanceByUserId(
    @Body() markAttendanceByUsernameDto: MarkAttendanceByUsernameDto,
    @Res() response: Response,
    @Req() request: Request,
    @GetUserId() userId: string,
  ): Promise<Response> {
    if (!request?.headers?.authorization) {
      throw new UnauthorizedException('Unauthorized');
    }
    const token = request.headers.authorization;
    return this.attendanceService.markAttendanceByUserId(
      markAttendanceByUsernameDto,
      userId,
      response,
      token,
    );
  }
}
