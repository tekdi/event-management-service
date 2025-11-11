import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
  Param,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import {
  MarkMeetingAttendanceDto,
  MarkAttendanceByUsernameDto,
} from './dto/markAttendance.dto';
import {
  API_ID,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from 'src/common/utils/constants.util';
import { OnlineMeetingAdapter } from 'src/online-meeting-adapters/onlineMeeting.adapter';
import {
  AttendanceRecord,
  UserDetails,
  AttendeesStatus,
} from 'src/common/utils/types';
import { EventRepetition } from '../event/entities/eventRepetition.entity';
import { EventAttendees } from '../attendees/entity/attendees.entity';
import { In, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LoggerWinston } from 'src/common/logger/logger.util';
import { Logger } from '@nestjs/common';
import { CheckpointService, SimpleCheckpoint } from './checkpoint.service';
import { MeetingType } from 'src/common/utils/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Event information interface for processing
 */
interface EventInfo {
  eventRepetitionId: string;
  eventId: string;
  zoomId: string;
  meetingType: 'meeting' | 'webinar';
  attendanceMarked: boolean;
}

/**
 * Result interface for event participant processing
 * Contains comprehensive statistics and pagination information
 */
interface ProcessingResult {
  totalParticipants: number;
  participantsProcessed: number;
  participantsAttended: number;
  participantsNotAttended: number;
  newAttendeeRecords: number;
  updatedAttendeeRecords: number;
  nextPageToken: string | null;
  pagination: {
    totalPages: number;
    currentPage: number;
    hasNextPage: boolean;
  };
}

@Injectable()
export class AttendanceService implements OnModuleInit {
  // utilize apis of the attendance service to mark event attendance

  private readonly logger = new Logger(AttendanceService.name);
  private readonly userServiceUrl: string;
  private readonly attendanceServiceUrl: string;
  private readonly onlineMeetingProvider: string;

  constructor(
    @InjectRepository(EventRepetition)
    private readonly eventRepetitionRepository: Repository<EventRepetition>,
    @InjectRepository(EventAttendees)
    private readonly eventAttendeesRepository: Repository<EventAttendees>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly onlineMeetingAdapter: OnlineMeetingAdapter,
    private readonly checkpointService: CheckpointService,
  ) {
    this.userServiceUrl = this.configService.get('USER_SERVICE');
    this.attendanceServiceUrl = this.configService.get('ATTENDANCE_SERVICE');
    this.onlineMeetingProvider = this.configService.get(
      'ONLINE_MEETING_ADAPTER',
    );
  }

  onModuleInit() {
    if (
      !this.userServiceUrl.trim().length ||
      !this.onlineMeetingProvider.trim().length
    ) {
      throw new InternalServerErrorException(
        `${ERROR_MESSAGES.ENVIRONMENT_VARIABLES_MISSING}: USER_SERVICE, ATTENDANCE_SERVICE`,
      );
    }
  }

  async markAttendanceForMeetingParticipants(
    markMeetingAttendanceDto: MarkMeetingAttendanceDto,
    userId: string,
    response: Response,
    authToken: string,
  ) {
    const apiId = API_ID.MARK_EVENT_ATTENDANCE;

    // check event exists
    const eventRepetition = await this.eventRepetitionRepository.findOne({
      where: {
        eventRepetitionId: markMeetingAttendanceDto.eventRepetitionId,
        eventDetail: {
          status: Not('archived'),
          eventType: 'online',
        },
      },
      relations: ['eventDetail'], // Ensure eventDetail is included
      select: {
        eventRepetitionId: true,
        eventDetail: {
          onlineProvider: true,
        },
      },
    });

    if (
      !eventRepetition ||
      eventRepetition.eventDetail.onlineProvider.toLowerCase() !==
        this.onlineMeetingProvider.toLowerCase()
    ) {
      throw new BadRequestException(ERROR_MESSAGES.EVENT_DOES_NOT_EXIST);
    }

    // get meeting participants
    const participantIdentifiers = await this.onlineMeetingAdapter
      .getAdapter()
      .getMeetingParticipantsIdentifiers(
        markMeetingAttendanceDto.meetingId,
        markMeetingAttendanceDto.markAttendanceBy,
        MeetingType.meeting,
        markMeetingAttendanceDto.pageSize,
      );

    // get userIds from email or username list in user service
    const userList: UserDetails[] = await this.getUserIdList(
      participantIdentifiers.identifiers,
      markMeetingAttendanceDto.markAttendanceBy,
      authToken,
    );

    // combine data from user service and meeting attendance
    const userDetailList = this.onlineMeetingAdapter
      .getAdapter()
      .getParticipantAttendance(
        userList,
        participantIdentifiers.inMeetingUserDetails,
        markMeetingAttendanceDto.markAttendanceBy,
      );

    if (!userDetailList.length) {
      throw new BadRequestException(ERROR_MESSAGES.NO_USERS_FOUND);
    }

    // mark attendance for each user
    const res = await this.markUsersAttendance(
      userDetailList,
      markMeetingAttendanceDto,
      userId,
      authToken,
    );

    LoggerWinston.log(
      SUCCESS_MESSAGES.ATTENDANCE_MARKED_FOR_MEETING,
      apiId,
      userId,
    );

    return response
      .status(HttpStatus.CREATED)
      .json(
        APIResponse.success(
          apiId,
          res,
          SUCCESS_MESSAGES.ATTENDANCE_MARKED_FOR_MEETING,
        ),
      );
  }

  async getUserIdList(
    identifiers: string[],
    markAttendanceBy: string,
    authToken: string,
  ): Promise<UserDetails[]> {
    // get userIds for emails or usernames provided from user service
    try {
      const filters = {};

      if (markAttendanceBy === 'email') {
        filters['email'] = identifiers;
      } else if (markAttendanceBy === 'username') {
        filters['username'] = identifiers;
      }
      const userListResponse = await this.httpService.axiosRef.post(
        `${this.userServiceUrl}/user/v1/list`,
        {
          limit: identifiers.length,
          offset: 0,
          filters,
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: authToken,
          },
        },
      );

      const userDetails = userListResponse.data.result.getUserDetails;

      if (!userDetails.length) {
        throw new BadRequestException(ERROR_MESSAGES.NO_USERS_FOUND);
      }

      return userDetails;
    } catch (e) {
      if (e.status === 404) {
        throw new BadRequestException(ERROR_MESSAGES.SERVICE_NOT_FOUND);
      }
      throw new InternalServerErrorException(ERROR_MESSAGES.USER_SERVICE_ERROR);
    }
  }

  async markUsersAttendance(
    userAttendance: AttendanceRecord[],
    markMeetingAttendanceDto: MarkMeetingAttendanceDto,
    loggedInUserId: string,
    authToken: string,
  ): Promise<any> {
    // mark attendance for each user in attendance service
    try {
      const attendanceMarkResponse = await this.httpService.axiosRef.post(
        `${this.attendanceServiceUrl}/api/v1/attendance/bulkAttendance?userId=${loggedInUserId}`,
        {
          attendanceDate: markMeetingAttendanceDto.attendanceDate,
          contextId: markMeetingAttendanceDto.eventRepetitionId,
          scope: markMeetingAttendanceDto.scope,
          context: 'event',
          userAttendance,
        },
        {
          headers: {
            Accept: 'application/json',
            tenantid: markMeetingAttendanceDto.tenantId,
            userId: loggedInUserId,
            Authorization: authToken,
          },
        },
      );

      return attendanceMarkResponse.data;
    } catch (e) {
      if (e.status === 404) {
        throw new BadRequestException(
          `Service not found ${e?.response?.data?.message}`,
        );
      } else if (e.status === 400) {
        throw new BadRequestException(
          `Bad request ${e?.response?.data?.message}`,
        );
      }
      throw new InternalServerErrorException(
        ERROR_MESSAGES.ATTENDANCE_SERVICE_ERROR,
      );
    }
  }

  /**
   * Main entry point for marking attendance with resumability support
   *
   * This method provides the primary API endpoint for attendance marking:
   * - Supports both single event and bulk processing
   * - Implements checkpoint-based resumability for long-running operations
   * - Handles errors gracefully and provides detailed response information
   * - Can resume from interruptions using stored checkpoint data
   *
   * @param dto - The attendance marking request data
   * @param userId - ID of the user initiating the process
   * @param response - Express response object for sending results
   * @param authToken - Authentication token for API calls
   * @returns Promise resolving to HTTP response
   */
  async markAttendance(
    userId: string,
    response: Response,
    authToken: string,
  ): Promise<Response> {
    const startTime = Date.now();
    const errors: string[] = [];
    const eventResults: any[] = [];

    try {
      // Process all ended events with resumability support
      const result = await this.processAllEndedEventsWithResumability(
        authToken,
        startTime,
        userId,
      );
      return this.sendSuccessResponse(response, result);
    } catch (error) {
      this.logger.error('Failed to mark attendance', error);
      return this.sendErrorResponse(response, error.message);
    }
  }

  /**
   * Processes all ended events with simplified checkpoint support
   *
   * This method handles attendance marking with simple checkpoint-based resumability:
   * 1. Gets events that need attendance marking
   * 2. Processes each event with individual simple checkpoints
   * 3. Handles errors and cleanup appropriately
   *
   * @param dto - The attendance marking request data
   * @param authToken - Authentication token for API calls
   * @param startTime - Timestamp when processing started
   * @param userId - ID of the user initiating the process
   * @returns Promise resolving to attendance marking response
   */
  private async processAllEndedEventsWithResumability(
    authToken: string,
    startTime: number,
    userId: string,
  ): Promise<any> {
    const errors: string[] = [];
    const eventResults: any[] = [];

    // Get events that need attendance marking
    const eventsToProcess = await this.getEndedEventsForAttendanceMarking();

    if (eventsToProcess.length === 0) {
      return {
        success: true,
        totalEventsProcessed: 0,
        successfulEvents: 0,
        failedEvents: 0,
        totalParticipantsProcessed: 0,
        processingTimeMs: Date.now() - startTime,
        errors: ['No ended events found for attendance marking'],
        eventResults: [],
        message: 'No ended events found for attendance marking',
      };
    }

    let totalEventsProcessed = 0;
    let successfulEvents = 0;
    let failedEvents = 0;
    let totalParticipantsProcessed = 0;

    // Process each event individually with simple checkpoints
    for (const event of eventsToProcess) {
      try {
        const eventInfo: EventInfo = {
          eventRepetitionId: event.eventRepetitionId,
          eventId: event.eventId,
          zoomId: (event.onlineDetails as any)?.id || '',
          meetingType: (event.onlineDetails as any)?.meetingType || 'meeting',
          attendanceMarked: event.attendanceMarked,
        };

        // Skip if already processed and not forcing reprocess
        if (eventInfo.attendanceMarked) {
          this.logger.log(
            `Event ${eventInfo.eventRepetitionId} already processed, skipping`,
          );
          continue;
        }

        // Process the event with checkpoint support
        const result = await this.processEventWithSimpleCheckpoint(
          eventInfo,
          authToken,
        );

        // Only mark as completed if all participants processed AND no more pages
        const isFullyCompleted =
          !result.pagination.hasNextPage &&
          result.participantsProcessed >= result.totalParticipants;

        eventResults.push({
          eventRepetitionId: eventInfo.eventRepetitionId,
          eventTitle: (event.eventDetail as any)?.eventTitle || 'Unknown Event',
          zoomId: eventInfo.zoomId,
          meetingType: eventInfo.meetingType,
          totalParticipants: result.totalParticipants,
          participantsProcessed: result.participantsProcessed,
          participantsAttended: result.participantsAttended,
          participantsNotAttended: result.participantsNotAttended,
          newAttendeeRecords: result.newAttendeeRecords,
          updatedAttendeeRecords: result.updatedAttendeeRecords,
          status: isFullyCompleted ? 'success' : 'partial',
          processingTimeMs: 0,
        });

        totalEventsProcessed++;
        if (isFullyCompleted) {
          successfulEvents++;
          // Mark event as completed only when fully done
          await this.markEventAttendanceCompleted(
            eventInfo.eventRepetitionId,
            result.participantsProcessed,
          );
        } else {
          // Event partially processed - will be resumed later
          this.logger.log(
            `Event ${eventInfo.eventRepetitionId} partially processed: ${result.participantsProcessed}/${result.totalParticipants} participants`,
          );
        }
        totalParticipantsProcessed += result.participantsProcessed;
      } catch (error) {
        this.logger.error(
          `Failed to process event ${event.eventRepetitionId}`,
          error,
        );
        failedEvents++;
        errors.push(`Event ${event.eventRepetitionId}: ${error.message}`);

        eventResults.push({
          eventRepetitionId: event.eventRepetitionId,
          eventTitle: (event.eventDetail as any)?.eventTitle || 'Unknown Event',
          zoomId: (event.onlineDetails as any)?.id || '',
          meetingType: (event.onlineDetails as any)?.meetingType || 'meeting',
          totalParticipants: 0,
          participantsProcessed: 0,
          participantsAttended: 0,
          participantsNotAttended: 0,
          newAttendeeRecords: 0,
          updatedAttendeeRecords: 0,
          status: 'failed',
          errorMessage: error.message,
          processingTimeMs: 0,
        });
      }
    }

    return {
      success: failedEvents === 0,
      totalEventsProcessed,
      successfulEvents,
      failedEvents,
      totalParticipantsProcessed,
      processingTimeMs: Date.now() - startTime,
      errors,
      eventResults,
      message: `Processed ${totalEventsProcessed} events successfully`,
    };
  }

  /**
   * Processes a single event with simple checkpoint support
   *
   * @param eventInfo - Information about the event being processed
   * @param dto - The attendance marking request data
   * @param authToken - Authentication token for API calls
   * @returns Promise resolving to processing result
   */
  private async processEventWithSimpleCheckpoint(
    eventInfo: EventInfo,
    authToken: string,
  ): Promise<ProcessingResult> {
    // Check if checkpoint exists
    let checkpoint = await this.checkpointService.loadCheckpoint(
      eventInfo.eventRepetitionId,
    );

    if (checkpoint) {
      this.logger.log(
        `Resuming event ${eventInfo.eventRepetitionId} from checkpoint`,
      );
      return await this.resumeEventFromCheckpoint(
        eventInfo,
        authToken,
        checkpoint,
      );
    }

    // Create new checkpoint
    checkpoint = await this.checkpointService.createCheckpoint(
      eventInfo.eventRepetitionId,
      eventInfo.eventId,
      eventInfo.zoomId,
    );

    // Process the event
    const result = await this.processEventParticipants(
      eventInfo,
      authToken,
      checkpoint,
    );

    // Only clean up checkpoint if event is fully completed
    const isFullyCompleted =
      !result.pagination.hasNextPage &&
      result.participantsProcessed >= result.totalParticipants;

    if (isFullyCompleted) {
      await this.checkpointService.deleteCheckpoint(
        eventInfo.eventRepetitionId,
      );
    }

    return result;
  }

  /**
   * Resumes event processing from an existing checkpoint
   *
   * @param eventInfo - Information about the event being processed
   * @param dto - The attendance marking request data
   * @param authToken - Authentication token for API calls
   * @param checkpoint - The existing checkpoint
   * @returns Promise resolving to processing result
   */
  private async resumeEventFromCheckpoint(
    eventInfo: EventInfo,
    authToken: string,
    checkpoint: SimpleCheckpoint,
  ): Promise<ProcessingResult> {
    this.logger.log(
      `Resuming event ${eventInfo.eventRepetitionId} from page ${checkpoint.currentPage}`,
    );
    return await this.processEventParticipants(
      eventInfo,
      authToken,
      checkpoint,
    );
  }

  /**
   * Processes event participants with checkpoint support
   *
   * @param eventInfo - Information about the event being processed
   * @param dto - The attendance marking request data
   * @param authToken - Authentication token for API calls
   * @param checkpoint - The checkpoint to update
   * @returns Promise resolving to processing result
   */
  private async processEventParticipants(
    eventInfo: EventInfo,
    authToken: string,
    checkpoint: SimpleCheckpoint,
  ): Promise<ProcessingResult> {
    const zoomId = eventInfo.zoomId;
    const meetingType = eventInfo.meetingType as MeetingType;

    let totalParticipants = checkpoint.totalParticipants;
    let participantsProcessed = checkpoint.participantsProcessed;
    let participantsAttended = 0;
    let participantsNotAttended = 0;
    let newAttendeeRecords = 0;
    let updatedAttendeeRecords = 0;
    let nextPageToken: string | null = checkpoint.nextPageToken;
    let currentPage = checkpoint.currentPage;

    try {
      // Get initial participant data if not resuming from checkpoint
      let initialResponse: any = null;
      if (totalParticipants === 0) {
        try {
          initialResponse = await this.onlineMeetingAdapter
            .getAdapter()
            .getMeetingParticipantList(
              await this.onlineMeetingAdapter.getAdapter().getToken(),
              [],
              zoomId,
              meetingType,
              '',
            );

          totalParticipants = initialResponse.total_records;

          nextPageToken = initialResponse.next_page_token;
          currentPage = 1;
          // Update checkpoint with total participants count
          checkpoint.totalParticipants = totalParticipants;
          checkpoint.nextPageToken = nextPageToken;
          checkpoint.currentPage = currentPage;
          await this.checkpointService.updateCheckpoint(checkpoint);
        } catch (error) {
          this.logger.error(
            `Failed to get initial participant list for event ${eventInfo.eventRepetitionId}`,
            error,
          );
          throw new Error(
            `Failed to fetch participants for event ${eventInfo.eventRepetitionId}: ${error.message}`,
          );
        }

        // Process participants from the initial response
        const result = await this.processParticipantBatch(
          initialResponse.participants,
          eventInfo,
          authToken,
        );

        participantsProcessed += result.participantsProcessed;
        participantsAttended += result.participantsAttended;
        participantsNotAttended += result.participantsNotAttended;
        newAttendeeRecords += result.newAttendeeRecords;
        updatedAttendeeRecords += result.updatedAttendeeRecords;
      }

      // Process remaining pages
      while (nextPageToken) {
        try {
          const participantResponse = await this.onlineMeetingAdapter
            .getAdapter()
            .getMeetingParticipantList(
              await this.onlineMeetingAdapter.getAdapter().getToken(),
              [],
              zoomId,
              meetingType,
              `&next_page_token=${nextPageToken}`,
            );

          const result = await this.processParticipantBatch(
            participantResponse.participants,
            eventInfo,
            authToken,
          );

          participantsProcessed += result.participantsProcessed;
          participantsAttended += result.participantsAttended;
          participantsNotAttended += result.participantsNotAttended;
          newAttendeeRecords += result.newAttendeeRecords;
          updatedAttendeeRecords += result.updatedAttendeeRecords;

          // Update pagination state
          nextPageToken = participantResponse.next_page_token;
          currentPage++;
          // Update checkpoint after each page
          checkpoint.nextPageToken = nextPageToken;
          checkpoint.currentPage = currentPage;
          checkpoint.participantsProcessed = participantsProcessed;
          await this.checkpointService.updateCheckpoint(checkpoint);

          break;
        } catch (error) {
          this.logger.error(
            `Failed to process page ${currentPage} for event ${eventInfo.eventRepetitionId}`,
            error,
          );
          // Break the loop on error to prevent infinite retries
          break;
        }
      }
      return {
        totalParticipants,
        participantsProcessed,
        participantsAttended,
        participantsNotAttended,
        newAttendeeRecords,
        updatedAttendeeRecords,
        nextPageToken,
        pagination: {
          totalPages: Math.ceil(totalParticipants / 300),
          currentPage: currentPage - 1,
          hasNextPage: !!nextPageToken, // true if there are more pages
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to process participants for event ${eventInfo.eventRepetitionId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Processes a batch of participants with optimized batch database operations
   *
   * @param participants - Array of participants to process
   * @param eventInfo - Information about the event being processed
   * @param dto - The attendance marking request data
   * @param authToken - Authentication token for API calls
   * @returns Promise resolving to batch processing result
   */
  private async processParticipantBatch(
    participants: any[],
    eventInfo: EventInfo,
    authToken: string,
  ): Promise<{
    participantsProcessed: number;
    participantsAttended: number;
    participantsNotAttended: number;
    newAttendeeRecords: number;
    updatedAttendeeRecords: number;
  }> {
    let participantsProcessed = 0;
    let participantsAttended = 0;
    let participantsNotAttended = 0;
    let newAttendeeRecords = 0;
    let updatedAttendeeRecords = 0;

    const registrantIds = participants
      .map((p) => p.registrant_id)
      .filter(Boolean);

    if (!registrantIds.length) {
      return {
        participantsProcessed: 0,
        participantsAttended: 0,
        participantsNotAttended: 0,
        newAttendeeRecords: 0,
        updatedAttendeeRecords: 0,
      };
    }

    const existingAttendees = await this.eventAttendeesRepository.findBy({
      eventRepetitionId: eventInfo.eventRepetitionId,
      registrantId: In(registrantIds),
    });

    const attendeeMap = new Map(
      existingAttendees.map((att) => [att.registrantId, att]),
    );

    const attendeesToPersist: EventAttendees[] = [];
    const now = new Date().toISOString();
    const lmsServiceCalls: Promise<any>[] = [];
    const LMS_BATCH_SIZE = 50;

    for (const participant of participants) {
      try {
        const identifier = participant.registrant_id;
        if (!identifier) {
          this.logger.warn(
            `Participant ${participant.id} missing registrant_id, skipping`,
          );
          continue;
        }

        let eventAttendee = attendeeMap.get(identifier);

        if (!eventAttendee) {
          continue;
        } else {
          updatedAttendeeRecords++;
          eventAttendee.isAttended = true;
          eventAttendee.duration = participant.duration || 0;
          eventAttendee.joinedLeftHistory = {
            joinTime: participant.join_time,
            leaveTime: participant.leave_time,
            duration: participant.duration,
            status: participant.status,
            zoomParticipantId: participant.id,
            lastUpdated: now,
          };

          attendeesToPersist.push(eventAttendee);

          // Call LMS service for lesson completion if participant attended
          const lmsCall = this.callLmsLessonCompletion(
            eventInfo.eventId,
            eventAttendee.userId,
            participant.duration || 0,
            authToken,
          ).catch((error) => {
            this.logger.error(
              `Failed to call LMS service for user ${eventAttendee.userId}`,
              error,
            );
            return null; // Don't fail the entire process if LMS call fails
          });
          lmsServiceCalls.push(lmsCall);

          // Process LMS calls in batches to prevent memory overload
          if (lmsServiceCalls.length >= LMS_BATCH_SIZE) {
            await Promise.allSettled(lmsServiceCalls);
            lmsServiceCalls.length = 0; // Clear array to release memory
          }
        }

        participantsProcessed++;
        eventAttendee.isAttended
          ? participantsAttended++
          : participantsNotAttended++;
      } catch (error) {
        this.logger.error(
          `Failed to process participant ${participant.id}`,
          error,
        );
        participantsProcessed++;
        participantsNotAttended++;
      }
    }

    if (attendeesToPersist.length > 0) {
      await this.eventAttendeesRepository.save(attendeesToPersist);
    }

    // Wait for remaining LMS service calls to complete
    if (lmsServiceCalls.length > 0) {
      await Promise.allSettled(lmsServiceCalls);
      lmsServiceCalls.length = 0; // Clear array to release memory
    }

    // Clear large arrays to help garbage collection
    attendeesToPersist.length = 0;
    registrantIds.length = 0;

    return {
      participantsProcessed,
      participantsAttended,
      participantsNotAttended,
      newAttendeeRecords,
      updatedAttendeeRecords,
    };
  }

  private async markEventAttendanceCompleted(
    eventRepetitionId: string,
    participantsProcessed: number,
  ): Promise<void> {
    await this.eventRepetitionRepository.update(
      { eventRepetitionId },
      {
        attendanceMarked: true,
        totalParticipantsProcessed: participantsProcessed,
      },
    );
    await this.checkpointService.deleteCheckpoint(eventRepetitionId);
  }

  private async getEndedEventsForAttendanceMarking(): Promise<
    EventRepetition[]
  > {
    const queryBuilder = this.eventRepetitionRepository
      .createQueryBuilder('er')
      .leftJoinAndSelect('er.eventDetail', 'ed')
      .leftJoinAndSelect('er.event', 'e')
      .where('er.endDateTime < :currentTime', { currentTime: new Date() })
      .andWhere('ed.eventType = :eventType', { eventType: 'online' })
      .andWhere('er.attendanceMarked = :attendanceMarked', {
        attendanceMarked: false,
      })
      .andWhere('er.onlineDetails IS NOT NULL');

    return queryBuilder.getMany();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private sendSuccessResponse(response: Response, data: any): Response {
    return response
      .status(HttpStatus.OK)
      .json(
        APIResponse.success(
          data,
          SUCCESS_MESSAGES.ATTENDANCE_MARKED_FOR_MEETING,
          API_ID.MARK_ATTENDANCE,
        ),
      );
  }

  private sendErrorResponse(response: Response, message: string): Response {
    return response
      .status(HttpStatus.BAD_REQUEST)
      .json(
        APIResponse.error(
          message,
          API_ID.MARK_ATTENDANCE,
          '400',
          'Bad Request',
        ),
      );
  }

  /**
   * Calls LMS service to mark lesson as completed for a user
   *
   * @param eventId - The event ID that maps to lesson.media.source
   * @param userId - The user ID
   * @param timeSpent - Time spent in seconds
   * @param authToken - Authentication token
   * @returns Promise resolving to LMS service response
   */
  private async callLmsLessonCompletion(
    eventId: string,
    userId: string,
    timeSpent: number,
    authToken: string,
  ): Promise<any> {
    try {
      const lmsServiceUrl = this.configService.get('LMS_SERVICE_URL');
      const tenantId = this.configService.get('TENANT_ID');
      const organisationId = this.configService.get('ORGANISATION_ID');

      if (!lmsServiceUrl) {
        this.logger.warn(
          'LMS_SERVICE_URL not configured, skipping lesson completion call',
        );
        return null;
      }
      const response = await this.httpService.axiosRef.patch(
        `${lmsServiceUrl}/v1/tracking/event/${eventId}`,
        {
          userId,
          status: 'completed',
          timeSpent: Math.floor(timeSpent), // Convert to integer seconds
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: authToken,
            tenantid: tenantId,
            organisationid: organisationId,
          },
        },
      );

      this.logger.log(
        `Successfully marked lesson completion for user ${userId} in event ${eventId}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to call LMS service for event ${eventId}, user ${userId}`,
        {
          error: error.message,
          status: error.response?.status,
          data: error.response?.data,
        },
      );
      throw error;
    }
  }

  /**
   * Helper method to flatten nested arrays recursively
   * @param arr - Array that may contain nested arrays
   * @returns Flattened array of objects
   */
  private flattenArray(arr: any[]): any[] {
    const result: any[] = [];
    for (const item of arr) {
      if (Array.isArray(item)) {
        result.push(...this.flattenArray(item));
      } else if (item && typeof item === 'object') {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Gets lessonId from eventId by calling LMS service
   * This method gets media by source (eventId), then gets lesson by mediaId
   *
   * @param eventId - The event ID that maps to lesson.media.source
   * @param authToken - Authentication token
   * @returns Promise resolving to lessonId
   */
  private async getLessonIdFromEventId(
    eventId: string,
    authToken: string,
  ): Promise<string | null> {
    try {
      const lmsServiceUrl = this.configService.get('LMS_SERVICE_URL');
      const tenantId = this.configService.get('TENANT_ID');
      const organisationId = this.configService.get('ORGANISATION_ID');

      if (!lmsServiceUrl) {
        this.logger.warn(
          'LMS_SERVICE_URL not configured, cannot get lessonId from eventId',
        );
        return null;
      }

      // Step 1: Get media by source (eventId)
      // Note: Media API might not support source filter, so we'll get all event format media and filter client-side
      let mediaList: any[] = [];
      
      try {
        // Get media with event format filter (to reduce results)
        const mediaResponse = await this.httpService.axiosRef.get(
          `${lmsServiceUrl}/v1/media`,
          {
            params: {
              format: 'event',
              limit: 1000, // Get more results to find the matching one
            },
            headers: {
              'Content-Type': 'application/json',
              Authorization: authToken,
              tenantid: tenantId,
              organisationid: organisationId,
            },
          },
        );

        // Handle different response structures
        let rawResult = mediaResponse.data?.result;
        
        this.logger.log(
          `Raw media API result type: ${Array.isArray(rawResult) ? 'array' : typeof rawResult}, length: ${Array.isArray(rawResult) ? rawResult.length : 'N/A'}`,
        );
        
        if (Array.isArray(rawResult)) {
          // Check if it's an array of arrays (nested structure)
          if (rawResult.length > 0 && Array.isArray(rawResult[0])) {
            // Flatten nested arrays
            this.logger.log(
              `Detected nested array structure, flattening...`,
            );
            mediaList = rawResult.flat();
          } else {
            // It's an array of objects
            mediaList = rawResult;
          }
        } else if (rawResult?.data && Array.isArray(rawResult.data)) {
          mediaList = rawResult.data;
        } else if (rawResult?.items && Array.isArray(rawResult.items)) {
          mediaList = rawResult.items;
        } else if (Array.isArray(mediaResponse.data)) {
          mediaList = mediaResponse.data;
        }
        
        // Ensure all items are objects, not arrays - flatten recursively if needed
        mediaList = this.flattenArray(mediaList);

        this.logger.log(
          `Retrieved ${mediaList.length} media items from LMS API (format: event)`,
        );
        
        // Log response structure for debugging
        if (mediaList.length === 0) {
          this.logger.warn(
            `Media API response structure (first 500 chars): ${JSON.stringify(mediaResponse.data).substring(0, 500)}`,
          );
        } else {
          // Log first media item structure for debugging
          this.logger.log(
            `Sample media item structure: ${JSON.stringify(mediaList[0]).substring(0, 500)}`,
          );
          // Log all sources for debugging
          const allSources = mediaList.map((m: any) => m.source || 'N/A');
          this.logger.log(
            `All media sources in array: ${JSON.stringify(allSources)}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error calling media API: ${error.message}`,
          {
            status: error.response?.status,
            data: error.response?.data,
          },
        );
        return null;
      }

      // Find media with matching source (eventId) - use trim and case-insensitive comparison for robustness
      const media = mediaList.find((m: any) => {
        const mediaSource = String(m.source || '').trim();
        const searchEventId = String(eventId).trim();
        return mediaSource === searchEventId;
      });
      
      if (!media) {
        this.logger.warn(
          `No media found with source ${eventId} in ${mediaList.length} media items`,
        );
        // Log all media sources for debugging
        if (mediaList.length > 0) {
          const sourcesList = mediaList.map((m: any) => ({
            source: m.source || 'N/A',
            mediaId: m.mediaId || m.media_id || m.id || 'N/A',
            format: m.format || 'N/A'
          }));
          this.logger.log(
            `All media sources: ${JSON.stringify(sourcesList)}`,
          );
        }
        return null;
      }

      // Log the found media object for debugging
      this.logger.log(
        `Found media object for source ${eventId}: ${JSON.stringify(media).substring(0, 400)}`,
      );

      // Extract mediaId - handle different property names
      const mediaId = media.mediaId || media.media_id || media.id;
      if (!mediaId) {
        this.logger.warn(
          `Media found but no mediaId for source ${eventId}. Media object keys: ${Object.keys(media).join(', ')}. Full object: ${JSON.stringify(media)}`,
        );
        return null;
      }

      this.logger.log(
        `Found media with mediaId ${mediaId} for source ${eventId}`,
      );

      // Step 2: Get lesson by mediaId
      let lessons: any[] = [];
      
      try {
        const lessonsResponse = await this.httpService.axiosRef.get(
          `${lmsServiceUrl}/v1/lessons`,
          {
            params: {
              status: 'published',
              limit: 1000, // Get more results to find the matching one
            },
            headers: {
              'Content-Type': 'application/json',
              Authorization: authToken,
              tenantid: tenantId,
              organisationid: organisationId,
            },
          },
        );

        // Handle different response structures
        let rawLessonsResult = lessonsResponse.data?.result;
        
        if (rawLessonsResult?.lessons && Array.isArray(rawLessonsResult.lessons)) {
          lessons = rawLessonsResult.lessons;
        } else if (Array.isArray(rawLessonsResult)) {
          lessons = rawLessonsResult;
        } else if (rawLessonsResult?.items && Array.isArray(rawLessonsResult.items)) {
          lessons = rawLessonsResult.items;
        } else if (Array.isArray(lessonsResponse.data)) {
          lessons = lessonsResponse.data;
        }
        
        // Flatten recursively if needed (same as media)
        lessons = this.flattenArray(lessons);

        this.logger.log(
          `Retrieved ${lessons.length} lessons from LMS API (status: published)`,
        );
        
        // Log response structure for debugging if no lessons found
        if (lessons.length === 0) {
          this.logger.warn(
            `Lessons API response structure (first 500 chars): ${JSON.stringify(lessonsResponse.data).substring(0, 500)}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error calling lessons API: ${error.message}`,
          {
            status: error.response?.status,
            data: error.response?.data,
          },
        );
        return null;
      }

      // Find lesson with matching mediaId
      const lesson = lessons.find((l: any) => 
        l.mediaId === mediaId || 
        l.media_id === mediaId || 
        (l.media && (l.media.mediaId === mediaId || l.media.media_id === mediaId))
      );

      if (!lesson) {
        this.logger.warn(
          `No lesson found for mediaId ${mediaId} in ${lessons.length} lessons`,
        );
        // Log sample lesson mediaIds for debugging
        if (lessons.length > 0) {
          this.logger.log(
            `Sample lesson mediaIds: ${lessons.slice(0, 5).map((l: any) => ({ 
              lessonId: l.lessonId || l.lesson_id || l.id || 'N/A',
              mediaId: l.mediaId || l.media_id || (l.media && (l.media.mediaId || l.media.media_id)) || 'N/A'
            }))}`,
          );
        }
        return null;
      }

      // Log the found lesson object for debugging
      this.logger.log(
        `Found lesson object for mediaId ${mediaId}: ${JSON.stringify(lesson).substring(0, 400)}`,
      );

      // Extract lessonId - handle different property names
      const lessonId = lesson.lessonId || lesson.lesson_id || lesson.id;
      if (!lessonId) {
        this.logger.warn(
          `Lesson found but no lessonId for mediaId ${mediaId}. Lesson object keys: ${Object.keys(lesson).join(', ')}. Full object: ${JSON.stringify(lesson)}`,
        );
        return null;
      }

      this.logger.log(
        `Successfully retrieved lessonId ${lessonId} from eventId ${eventId}`,
      );
      return lessonId;
    } catch (error) {
      this.logger.error(
        `Error getting lessonId from eventId ${eventId}`,
        {
          error: error.message,
          status: error.response?.status,
          data: error.response?.data,
        },
      );
      return null;
    }
  }

  /**
   * Calls LMS service to create a lesson tracking attempt
   *
   * @param lessonId - The lesson ID
   * @param userId - The user ID
   * @param authToken - Authentication token
   * @returns Promise resolving to LMS service response
   */
  private async callLmsLessonAttempt(
    lessonId: string,
    userId: string,
    authToken: string,
  ): Promise<any> {
    try {
      const lmsServiceUrl = this.configService.get('LMS_SERVICE_URL');
      const tenantId = this.configService.get('TENANT_ID');
      const organisationId = this.configService.get('ORGANISATION_ID');

      if (!lmsServiceUrl) {
        this.logger.warn(
          'LMS_SERVICE_URL not configured, skipping lesson attempt call',
        );
        return null;
      }

      const response = await this.httpService.axiosRef.post(
        `${lmsServiceUrl}/v1/tracking/lesson/attempt/${lessonId}?userId=${userId}`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: authToken,
            tenantid: tenantId,
            organisationid: organisationId,
          },
        },
      );

      this.logger.log(
        `Successfully created lesson attempt for user ${userId} in lesson ${lessonId}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to call LMS lesson attempt API for lesson ${lessonId}, user ${userId}`,
        {
          error: error.message,
          status: error.response?.status,
          data: error.response?.data,
        },
      );
      throw error;
    }
  }

  /**
   * Calls LMS service to mark lesson as completed with automatic retry if tracking not found
   * If the lesson track doesn't exist (404), it will create it first, then retry completion
   *
   * @param eventId - The event ID that maps to lesson.media.source
   * @param userId - The user ID
   * @param timeSpent - Time spent in seconds
   * @param authToken - Authentication token
   * @returns Promise resolving to LMS service response
   */
  private async callLmsLessonCompletionWithRetry(
    eventId: string,
    userId: string,
    timeSpent: number,
    authToken: string,
  ): Promise<any> {
    const apiId = API_ID.MARK_ATTENDANCE_BY_USERNAME;
    
    try {
      // First, try to mark completion
      return await this.callLmsLessonCompletion(eventId, userId, timeSpent, authToken);
    } catch (error) {
      // Check if error is 404 (Tracking not found)
      const errorStatus = error.response?.status;
      const errorData = error.response?.data;
      const errorMessage = errorData?.params?.errmsg || errorData?.message || error.message;

      if (errorStatus === 404 && 
          (errorMessage.includes('Tracking not found') || 
           errorMessage.includes('TRACKING_NOT_FOUND') ||
           errorMessage.includes('Lesson track'))) {
        
        this.logger.log(
          `[${apiId}] Lesson track not found for eventId ${eventId}, userId ${userId}. Attempting to create lesson track entry...`,
        );

        try {
          // Step 1: Get lessonId from eventId
          const lessonId = await this.getLessonIdFromEventId(eventId, authToken);
          
          if (!lessonId) {
            this.logger.warn(
              `[${apiId}] Cannot create lesson track - could not get lessonId from eventId ${eventId}`,
            );
            // Return null to indicate failure but don't throw to avoid breaking the flow
            return null;
          }

          this.logger.log(
            `[${apiId}] Retrieved lessonId ${lessonId} from eventId ${eventId}. Creating lesson track entry...`,
          );

          // Step 2: Create lesson track entry by calling lesson attempt API
          await this.callLmsLessonAttempt(lessonId, userId, authToken);

          this.logger.log(
            `[${apiId}] Successfully created lesson track entry for lessonId ${lessonId}, userId ${userId}. Retrying completion...`,
          );

          // Step 3: Retry the completion call
          const retryResult = await this.callLmsLessonCompletion(eventId, userId, timeSpent, authToken);
          
          this.logger.log(
            `[${apiId}] Successfully marked lesson completion after creating lesson track entry for eventId ${eventId}, userId ${userId}`,
          );
          
          return retryResult;
        } catch (createError) {
          this.logger.error(
            `[${apiId}] Failed to create lesson track entry for eventId ${eventId}, userId ${userId}`,
            {
              error: createError.message,
              status: createError.response?.status,
              data: createError.response?.data,
            },
          );
          // Return null to indicate failure but don't throw to avoid breaking the flow
          return null;
        }
      } else {
        // For other errors, re-throw
        throw error;
      }
    }
  }

  /**
   * Mark attendance by userId directly (without Zoom API and User Service lookup)
   * This method is designed for Postman runner testing and manual attendance marking
   *
   * Flow:
   * 1. Validate event exists
   * 2. Create attendance records directly from provided userIds (skip User Service)
   * 3. Update EventAttendees table to mark users as attended (isAttended = true, duration, joinedLeftHistory)
   * 4. Skip Attendance Service call (bypassed)
   * 5. Mark lesson completion in LMS Service
   *
   * @param markAttendanceByUsernameDto - DTO containing userIds and event details
   * @param loggedInUserId - User ID of the person marking attendance
   * @param response - Express response object
   * @param authToken - Authentication token
   * @returns Promise resolving to HTTP response
   */
  async markAttendanceByUserId(
    markAttendanceByUsernameDto: MarkAttendanceByUsernameDto,
    loggedInUserId: string,
    response: Response,
    authToken: string,
  ): Promise<Response> {
    const apiId = API_ID.MARK_ATTENDANCE_BY_USERNAME;
    const startTime = Date.now();

    this.logger.log(
      `[${apiId}] Starting attendance marking by userId - Event Repetition ID: ${markAttendanceByUsernameDto.eventRepetitionId}`,
    );
    this.logger.log(
      `[${apiId}] Number of userIds to process: ${markAttendanceByUsernameDto.userIds.length}`,
    );
    this.logger.log(
      `[${apiId}] User IDs: ${JSON.stringify(markAttendanceByUsernameDto.userIds)}`,
    );

    try {
      // Step 1: Validate event exists
      this.logger.log(`[${apiId}] Step 1: Validating event exists...`);
      const eventRepetition = await this.eventRepetitionRepository.findOne({
        where: {
          eventRepetitionId: markAttendanceByUsernameDto.eventRepetitionId,
          eventDetail: {
            status: Not('archived'),
          },
        },
        relations: ['eventDetail'],
        select: {
          eventRepetitionId: true,
          eventId: true,
          eventDetail: {
            title: true,
            status: true,
          },
        },
      });

      if (!eventRepetition) {
        this.logger.error(
          `[${apiId}] Event not found: ${markAttendanceByUsernameDto.eventRepetitionId}`,
        );
        throw new BadRequestException(ERROR_MESSAGES.EVENT_DOES_NOT_EXIST);
      }

      this.logger.log(
        `[${apiId}] Event validated successfully - Event ID: ${eventRepetition.eventId || markAttendanceByUsernameDto.eventId}, Title: ${eventRepetition.eventDetail.title}`,
      );

      // Step 2: Create attendance records directly from provided userIds (skip User Service lookup)
      this.logger.log(
        `[${apiId}] Step 2: Creating attendance records directly from ${markAttendanceByUsernameDto.userIds.length} userIds (skipping User Service lookup)...`,
      );
      const timeSpent = markAttendanceByUsernameDto.timeSpent || 0;
      const now = new Date().toISOString();

      const userAttendance: AttendanceRecord[] =
        markAttendanceByUsernameDto.userIds.map((userId) => {
          this.logger.log(
            `[${apiId}] Creating attendance record for userId: ${userId}`,
          );
          return {
            userId: userId,
            attendance: 'present',
            metaData: {
              autoMarked: true,
              duration: timeSpent,
              joinTime: now,
              leaveTime: now,
            },
          };
        });

      this.logger.log(
        `[${apiId}] Created ${userAttendance.length} attendance records`,
      );

      // Step 3: Update EventAttendees table to mark users as attended
      this.logger.log(
        `[${apiId}] Step 3: Updating EventAttendees table to mark users as attended...`,
      );

      // Try to find existing attendees by eventRepetitionId and userId
      const existingAttendees = await this.eventAttendeesRepository.find({
        where: {
          eventRepetitionId: markAttendanceByUsernameDto.eventRepetitionId,
          userId: In(markAttendanceByUsernameDto.userIds),
        },
      });

      this.logger.log(
        `[${apiId}] Found ${existingAttendees.length} existing attendee records for ${markAttendanceByUsernameDto.userIds.length} userIds`,
      );

      // If not found, try to find by eventId and userId (in case eventRepetitionId is different)
      let allExistingAttendees = existingAttendees;
      if (existingAttendees.length === 0) {
        this.logger.log(
          `[${apiId}] No attendees found by eventRepetitionId, trying to find by eventId...`,
        );
        const attendeesByEventId = await this.eventAttendeesRepository.find({
          where: {
            eventId: markAttendanceByUsernameDto.eventId,
            userId: In(markAttendanceByUsernameDto.userIds),
          },
        });
        this.logger.log(
          `[${apiId}] Found ${attendeesByEventId.length} attendee records by eventId`,
        );
        allExistingAttendees = attendeesByEventId;
      }

      const attendeesToUpdate: EventAttendees[] = [];
      const attendeesToCreate: EventAttendees[] = [];
      let updatedAttendeeRecords = 0;
      let createdAttendeeRecords = 0;

      for (const userId of markAttendanceByUsernameDto.userIds) {
        let eventAttendee = allExistingAttendees.find(
          (att) => att.userId === userId,
        );

        if (eventAttendee) {
          // Update existing record
          this.logger.log(
            `[${apiId}] Updating existing EventAttendee record for userId: ${userId}`,
          );
          eventAttendee.isAttended = true;
          eventAttendee.duration = timeSpent;
          eventAttendee.eventRepetitionId =
            markAttendanceByUsernameDto.eventRepetitionId; // Ensure eventRepetitionId is set
          eventAttendee.eventId = markAttendanceByUsernameDto.eventId; // Ensure eventId is set
          eventAttendee.joinedLeftHistory = {
            joinTime: now,
            leaveTime: now,
            duration: timeSpent,
            status: 'attended',
            lastUpdated: now,
          };
          eventAttendee.updatedAt = new Date();
          eventAttendee.updatedBy = loggedInUserId;
          attendeesToUpdate.push(eventAttendee);
          updatedAttendeeRecords++;
        } else {
          // Create new record if it doesn't exist
          this.logger.log(
            `[${apiId}] Creating new EventAttendee record for userId: ${userId}`,
          );
          const newEventAttendee = new EventAttendees();
          newEventAttendee.userId = userId;
          newEventAttendee.eventId = markAttendanceByUsernameDto.eventId;
          newEventAttendee.eventRepetitionId =
            markAttendanceByUsernameDto.eventRepetitionId;
          newEventAttendee.isAttended = true;
          newEventAttendee.duration = timeSpent;
          newEventAttendee.joinedLeftHistory = {
            joinTime: now,
            leaveTime: now,
            duration: timeSpent,
            status: 'attended',
            lastUpdated: now,
          };
          newEventAttendee.enrolledAt = new Date();
          newEventAttendee.enrolledBy = loggedInUserId;
          newEventAttendee.updatedAt = new Date();
          newEventAttendee.updatedBy = loggedInUserId;
          newEventAttendee.status = AttendeesStatus.active;
          attendeesToCreate.push(newEventAttendee);
          createdAttendeeRecords++;
        }
      }

      // Save updates and creates
      if (attendeesToUpdate.length > 0) {
        await this.eventAttendeesRepository.save(attendeesToUpdate);
        this.logger.log(
          `[${apiId}] Successfully updated ${updatedAttendeeRecords} EventAttendee records in database`,
        );
      }

      if (attendeesToCreate.length > 0) {
        await this.eventAttendeesRepository.save(attendeesToCreate);
        this.logger.log(
          `[${apiId}] Successfully created ${createdAttendeeRecords} new EventAttendee records in database`,
        );
      }

      const totalAttendeesProcessed =
        updatedAttendeeRecords + createdAttendeeRecords;
      if (totalAttendeesProcessed === 0) {
        this.logger.warn(
          `[${apiId}] No EventAttendee records were updated or created.`,
        );
      }

      // Step 4: Skip Attendance Service call (bypassed as per requirement)
      this.logger.log(
        `[${apiId}] Step 4: Skipping Attendance Service call (bypassed)...`,
      );
      this.logger.log(
        `[${apiId}] Attendance marking in Attendance Service is bypassed for this API`,
      );

      // Step 5: Mark lesson completion in LMS Service (only for users whose EventAttendees were updated/created)
      // Same logic as markAttendance API - only call LMS for users who were successfully marked as attended
      const processedUserIds = [...attendeesToUpdate, ...attendeesToCreate].map(
        (att) => att.userId,
      );
      this.logger.log(
        `[${apiId}] Step 5: Marking lesson completion in LMS Service for ${processedUserIds.length} users (only for users with EventAttendees updated/created)...`,
      );

      const lmsServiceCalls: Promise<any>[] = [];
      const LMS_BATCH_SIZE = 50;
      let lmsSuccessCount = 0;
      let lmsFailureCount = 0;

      // Only call LMS for users whose EventAttendees were successfully updated/created (same as markAttendance API)
      for (const eventAttendee of [
        ...attendeesToUpdate,
        ...attendeesToCreate,
      ]) {
        if (!eventAttendee.isAttended) {
          this.logger.log(
            `[${apiId}] Skipping LMS call for userId: ${eventAttendee.userId} - not marked as attended`,
          );
          continue;
        }

        this.logger.log(
          `[${apiId}] Calling LMS service for userId: ${eventAttendee.userId} (EventAttendee updated/created)`,
        );

        // Call LMS service for lesson completion if participant attended (same as markAttendance API)
        // Use callLmsLessonCompletionWithRetry to automatically create lesson track if it doesn't exist
        const lmsCall = this.callLmsLessonCompletionWithRetry(
          markAttendanceByUsernameDto.eventId,
          eventAttendee.userId,
          eventAttendee.duration || timeSpent,
          authToken,
        )
          .then((result) => {
            lmsSuccessCount++;
            this.logger.log(
              `[${apiId}] Successfully marked LMS lesson completion for userId: ${eventAttendee.userId}`,
            );
            return result;
          })
          .catch((error) => {
            lmsFailureCount++;
            this.logger.error(
              `[${apiId}] Failed to call LMS service for user ${eventAttendee.userId}`,
              {
                error: error.message,
                status: error.response?.status,
                data: error.response?.data,
              },
            );
            return null; // Don't fail the entire process if LMS call fails (same as markAttendance API)
          });

        lmsServiceCalls.push(lmsCall);

        // Process LMS calls in batches to prevent memory overload (same as markAttendance API)
        if (lmsServiceCalls.length >= LMS_BATCH_SIZE) {
          this.logger.log(
            `[${apiId}] Processing batch of ${LMS_BATCH_SIZE} LMS calls...`,
          );
          await Promise.allSettled(lmsServiceCalls);
          lmsServiceCalls.length = 0; // Clear array to release memory
        }
      }

      // Wait for remaining LMS service calls to complete (same as markAttendance API)
      if (lmsServiceCalls.length > 0) {
        this.logger.log(
          `[${apiId}] Processing remaining ${lmsServiceCalls.length} LMS calls...`,
        );
        await Promise.allSettled(lmsServiceCalls);
      }

      this.logger.log(
        `[${apiId}] LMS Service calls completed - Success: ${lmsSuccessCount}, Failed: ${lmsFailureCount}`,
      );

      // Calculate processing time
      const processingTimeMs = Date.now() - startTime;
      this.logger.log(
        `[${apiId}] Total processing time: ${processingTimeMs}ms`,
      );

      // Prepare response
      const result = {
        eventRepetitionId: markAttendanceByUsernameDto.eventRepetitionId,
        eventId: markAttendanceByUsernameDto.eventId,
        totalUsersProcessed: markAttendanceByUsernameDto.userIds.length,
        eventAttendeesUpdated: updatedAttendeeRecords,
        eventAttendeesCreated: createdAttendeeRecords,
        totalEventAttendeesProcessed:
          updatedAttendeeRecords + createdAttendeeRecords,
        attendanceMarked: 'bypassed', // Attendance Service call is bypassed
        lmsLessonCompletion: {
          total: markAttendanceByUsernameDto.userIds.length,
          success: lmsSuccessCount,
          failed: lmsFailureCount,
        },
        processingTimeMs,
        userIds: markAttendanceByUsernameDto.userIds,
        note: 'EventAttendees table updated/created, Attendance Service call bypassed, LMS lesson completion marked',
      };

      this.logger.log(`[${apiId}] Attendance marking completed successfully`);
      this.logger.log(`[${apiId}] Final result: ${JSON.stringify(result)}`);

      LoggerWinston.log(
        `LMS lesson completion marked for ${markAttendanceByUsernameDto.userIds.length} users by userId (Attendance Service bypassed)`,
        apiId,
        loggedInUserId,
      );

      return response
        .status(HttpStatus.CREATED)
        .json(
          APIResponse.success(
            apiId,
            result,
            `LMS lesson completion marked successfully for ${markAttendanceByUsernameDto.userIds.length} users (Attendance Service bypassed)`,
          ),
        );
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      this.logger.error(`[${apiId}] Error occurred during attendance marking`, {
        error: error.message,
        stack: error.stack,
        processingTimeMs,
        eventRepetitionId: markAttendanceByUsernameDto.eventRepetitionId,
        userIds: markAttendanceByUsernameDto.userIds,
      });

      throw error;
    }
  }
}
