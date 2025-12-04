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
        let result;
        try {
          result = await this.processEventWithSimpleCheckpoint(
            eventInfo,
            authToken,
          );
        } catch (error) {
          // Handle 404 errors - mark event as processed to skip in future
          if (error.message?.includes('404')) {
            this.logger.warn(
              `Zoom meeting not found (404) for event ${eventInfo.eventRepetitionId}, marking as processed to skip`,
            );
            await this.markEventAttendanceCompleted(
              eventInfo.eventRepetitionId,
              0,
            );
            eventResults.push({
              eventRepetitionId: eventInfo.eventRepetitionId,
              eventTitle:
                event.eventDetail?.title || 'Unknown Event',
              zoomId: eventInfo.zoomId,
              meetingType: eventInfo.meetingType,
              totalParticipants: 0,
              participantsProcessed: 0,
              participantsAttended: 0,
              participantsNotAttended: 0,
              newAttendeeRecords: 0,
              updatedAttendeeRecords: 0,
              status: 'skipped',
              errorMessage: 'Zoom meeting not found (404)',
              processingTimeMs: 0,
            });
            totalEventsProcessed++;
            continue;
          }
          // Re-throw other errors
          throw error;
        }

        // Mark as completed when:
        // 1. No more pages to process (pagination complete) AND
        // 2. Either all participants processed OR we've processed all processable participants
        // Note: Some participants may be skipped (no registrant_id or not enrolled),
        // so if pagination is complete (no more pages), we've processed everything we can
        const isFullyCompleted =
          !result.pagination.hasNextPage &&
          (result.participantsProcessed >= result.totalParticipants ||
            // If no more pages, we've processed all available participants
            // (remaining difference is due to skipped participants that can't be processed)
            result.participantsProcessed > 0);

        eventResults.push({
          eventRepetitionId: eventInfo.eventRepetitionId,
          eventTitle: event.eventDetail?.title || 'Unknown Event',
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
          eventTitle: event.eventDetail?.title || 'Unknown Event',
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
      // Get initial participant data if starting fresh or if checkpoint is inconsistent
      let initialResponse: any = null;
      // Process first page if: no total participants OR resuming but haven't processed first page yet
      // Also fetch if checkpoint seems wrong (very low totalParticipants but expecting more)
      const shouldFetchFirstPage =
        totalParticipants === 0 ||
        (currentPage === 1 && participantsProcessed === 0 && !nextPageToken) ||
        (totalParticipants > 0 && totalParticipants < 10 && currentPage === 1); // Suspiciously low count

      if (shouldFetchFirstPage) {
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

          // Warn if total_records doesn't match participants count (possible pagination)
          if (
            initialResponse.total_records > initialResponse.participants?.length
          ) {
            const missing =
              initialResponse.total_records -
              (initialResponse.participants?.length || 0);
            this.logger.warn(
              `⚠️ PAGINATION DETECTED: Zoom API reports ${initialResponse.total_records} total participants, but only ${initialResponse.participants?.length || 0} in first page. ${missing} participant(s) are on next page(s). next_page_token: ${initialResponse.next_page_token ? 'exists' : 'null'}`,
            );
          }

          // Warn if total_records seems suspiciously low
          if (
            initialResponse.total_records > 0 &&
            initialResponse.total_records < 10
          ) {
            this.logger.warn(
              `⚠️ WARNING: Zoom API returned only ${initialResponse.total_records} total participants. This seems low. Expected 12-13 pages (3600-3900 participants). Check Zoom API response or meeting settings.`,
            );
          }

          // Convert empty string to null for nextPageToken
          nextPageToken =
            initialResponse.next_page_token &&
            initialResponse.next_page_token.trim() !== ''
              ? initialResponse.next_page_token
              : null;
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
          // Check if it's a 404 error
          if (error.message?.includes('404')) {
            throw new Error(
              `Zoom meeting not found (404) for event ${eventInfo.eventRepetitionId}. The meeting may have been deleted.`,
            );
          }
          throw new Error(
            `Failed to fetch participants for event ${eventInfo.eventRepetitionId}: ${error.message}`,
          );
        }

        // Log summary of Zoom API response
        if (initialResponse.participants && initialResponse.participants.length > 0) {
          const participantsWithoutRegistrantId =
            initialResponse.participants.filter(
              (p: any) => !p.registrant_id || p.registrant_id.trim() === '',
            );
          if (participantsWithoutRegistrantId.length > 0) {
            this.logger.warn(
              `Zoom API returned ${initialResponse.participants.length} participants, ${participantsWithoutRegistrantId.length} without registrant_id (will be skipped)`,
            );
          }
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

        // Update checkpoint after processing first page
        checkpoint.participantsProcessed = participantsProcessed;
        checkpoint.nextPageToken = nextPageToken;
        checkpoint.currentPage = currentPage;
        await this.checkpointService.updateCheckpoint(checkpoint);

      }


      // Continue processing while there's a valid nextPageToken (not null, not empty string)
      while (nextPageToken && nextPageToken.trim() !== '') {
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

          // Log summary for paginated pages
          if (
            participantResponse.participants &&
            participantResponse.participants.length > 0
          ) {
            const participantsWithoutRegistrantId =
              participantResponse.participants.filter(
                (p: any) => !p.registrant_id || p.registrant_id.trim() === '',
              );
            if (participantsWithoutRegistrantId.length > 0) {
              this.logger.warn(
                `Page ${currentPage + 1}: ${participantResponse.participants.length} participants, ${participantsWithoutRegistrantId.length} without registrant_id (will be skipped)`,
              );
            }
          }

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

          // Update pagination state - convert empty string to null
          nextPageToken =
            participantResponse.next_page_token &&
            participantResponse.next_page_token.trim() !== ''
              ? participantResponse.next_page_token
              : null;
          currentPage++;


          // Update checkpoint after each page
          checkpoint.nextPageToken = nextPageToken;
          checkpoint.currentPage = currentPage;
          checkpoint.participantsProcessed = participantsProcessed;
          await this.checkpointService.updateCheckpoint(checkpoint);

          // Continue loop if there are more pages (nextPageToken will be checked in while condition)
        } catch (error) {
          this.logger.error(
            `Failed to process page ${currentPage} for event ${eventInfo.eventRepetitionId}`,
            error,
          );
          // Break the loop on error to prevent infinite retries
          break;
        }
      }

      // Calculate total participants that were actually processable (excluding those without registrant_id)
      // This helps determine if we've processed all processable participants even if some were skipped
      const totalProcessableParticipants = totalParticipants; // Will be adjusted based on actual processing
      
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
   * Aggregates duration across all sessions for the same user and checks threshold
   *
   * @param participants - Array of participants to process
   * @param eventInfo - Information about the event being processed
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

    // Filter out participants without registrant_id
    const participantsWithoutRegistrantId = participants.filter(
      (p) => !p.registrant_id || p.registrant_id.trim() === '',
    );
    const validParticipants = participants.filter(
      (p) => p.registrant_id && p.registrant_id.trim() !== '',
    );

    if (participantsWithoutRegistrantId.length > 0) {
      this.logger.warn(
        `Found ${participantsWithoutRegistrantId.length} participants WITHOUT registrant_id (will be skipped): ${JSON.stringify(
          participantsWithoutRegistrantId.map((p: any) => ({
            id: p.id,
            email: p.user_email,
            name: p.name,
            duration: p.duration,
            join_time: p.join_time,
            leave_time: p.leave_time,
          })),
        )}`,
      );
    }

    if (!validParticipants.length) {
      this.logger.warn(
        `No valid participants with registrant_id in batch for event ${eventInfo.eventRepetitionId}. Total participants: ${participants.length}, Without registrant_id: ${participantsWithoutRegistrantId.length}`,
      );
      return {
        participantsProcessed: 0,
        participantsAttended: 0,
        participantsNotAttended: 0,
        newAttendeeRecords: 0,
        updatedAttendeeRecords: 0,
      };
    }


    // Step 1: Group participants by registrantId
    const participantsByRegistrantId = new Map<string, any[]>();

    for (const participant of validParticipants) {
      const registrantId = participant.registrant_id;
      // validParticipants already filtered, so registrantId should exist
      if (!participantsByRegistrantId.has(registrantId)) {
        participantsByRegistrantId.set(registrantId, []);
      }
      participantsByRegistrantId.get(registrantId)?.push(participant);
    }

    const uniqueRegistrantIds = Array.from(participantsByRegistrantId.keys());

    // Step 2: Load event detail to get minAttendanceDurationMinutes
    const eventRepetition = await this.eventRepetitionRepository.findOne({
      where: { eventRepetitionId: eventInfo.eventRepetitionId },
      relations: ['eventDetail'],
    });

    if (!eventRepetition?.eventDetail) {
      this.logger.error(
        `EventDetail not found for eventRepetitionId: ${eventInfo.eventRepetitionId}`,
      );
      throw new Error(
        `EventDetail not found for eventRepetitionId: ${eventInfo.eventRepetitionId}`,
      );
    }

    // Check if minAttendanceDurationMinutes is set in database
    const dbValue = eventRepetition.eventDetail.minAttendanceDurationMinutes;

    // If minAttendanceDurationMinutes is NULL, undefined, or 0, skip processing
    if (dbValue === null || dbValue === undefined || dbValue === 0) {
      let dbValueDescription: string;
      if (dbValue === null) {
        dbValueDescription = 'NULL';
      } else if (dbValue === undefined) {
        dbValueDescription = 'undefined';
      } else {
        dbValueDescription = '0';
      }
      this.logger.warn(
        `⚠️ Skipping attendance processing for event ${eventInfo.eventRepetitionId}: minAttendanceDurationMinutes is ${dbValueDescription}. Please set minAttendanceDurationMinutes in EventDetails table before processing attendance.`,
      );
      throw new BadRequestException(
        `Cannot process attendance for event ${eventInfo.eventRepetitionId}: minAttendanceDurationMinutes is not configured. Please set minAttendanceDurationMinutes in EventDetails table (must be > 0).`,
      );
    }

    const minAttendanceDurationMinutes = dbValue;
    const minAttendanceDurationSeconds = minAttendanceDurationMinutes * 60;

    // Step 3: Load existing attendees for all registrantIds in batch (single DB query)
    const existingAttendees = await this.eventAttendeesRepository.findBy({
      eventRepetitionId: eventInfo.eventRepetitionId,
      registrantId: In(uniqueRegistrantIds),
    });

    const attendeeMap = new Map(
      existingAttendees.map((att) => [att.registrantId, att]),
    );

    const missingRegistrantIds = uniqueRegistrantIds.filter(
      (id) => !attendeeMap.has(id),
    );

    if (missingRegistrantIds.length > 0) {
      this.logger.warn(
        `Found ${missingRegistrantIds.length} registrantIds from Zoom not enrolled in event (will be skipped)`,
      );
    }

    // Step 4: Process each unique registrantId
    const attendeesToPersist: EventAttendees[] = [];
    const now = new Date().toISOString();
    const lmsServiceCalls: Promise<any>[] = [];
    const LMS_BATCH_SIZE = 50;

    for (const [
      registrantId,
      participantSessions,
    ] of participantsByRegistrantId) {
      try {
        let eventAttendee = attendeeMap.get(registrantId);

        if (!eventAttendee) {
          // Skip if attendee doesn't exist in DB
          this.logger.warn(
            `EventAttendee not found for registrantId: ${registrantId}, skipping ${participantSessions.length} participant sessions. This user may not be enrolled in the event.`,
          );
          participantsProcessed += participantSessions.length;
          participantsNotAttended += participantSessions.length;
          continue;
        }


        // Step 4a: Aggregate all sessions in current batch for this user
        const batchSessions: any[] = [];
        let batchTotalDuration = 0;

        for (const participant of participantSessions) {
          const sessionDuration = participant.duration || 0;
          batchTotalDuration += sessionDuration;

          const session = {
            joinTime: participant.join_time,
            leaveTime: participant.leave_time,
            duration: sessionDuration,
            status: participant.status,
            zoomParticipantId: participant.id || participant.user_id || null, // Use user_id as fallback
            lastUpdated: now,
          };

          batchSessions.push(session);
        }

        // Step 4b: Load existing joinedLeftHistory and convert to array format if needed
        let existingSessions: any[] = [];
        if (eventAttendee.joinedLeftHistory) {
          existingSessions = this.normalizeJoinedLeftHistory(
            eventAttendee.joinedLeftHistory,
          );
        }

        // Step 4c: Merge new sessions with existing (avoid duplicates)
        // Use multiple methods to detect duplicates since zoomParticipantId might be empty
        const existingSessionKeys = new Set<string>();

        // Create unique keys for existing sessions
        for (const existingSession of existingSessions) {
          if (existingSession.zoomParticipantId) {
            existingSessionKeys.add(`id:${existingSession.zoomParticipantId}`);
          }
          // Also use joinTime + leaveTime + duration as fallback key
          if (existingSession.joinTime && existingSession.leaveTime) {
            existingSessionKeys.add(
              `time:${existingSession.joinTime}:${existingSession.leaveTime}:${existingSession.duration || 0}`,
            );
          }
        }

        // Filter out duplicates from new sessions
        const newSessions = batchSessions.filter((session) => {
          // Check by zoomParticipantId if available
          if (session.zoomParticipantId) {
            const idKey = `id:${session.zoomParticipantId}`;
            if (existingSessionKeys.has(idKey)) {
              return false; // Duplicate by ID
            }
          }

          // Check by time combination (joinTime + leaveTime + duration)
          if (session.joinTime && session.leaveTime) {
            const timeKey = `time:${session.joinTime}:${session.leaveTime}:${session.duration || 0}`;
            if (existingSessionKeys.has(timeKey)) {
              return false; // Duplicate by time
            }
          }

          return true; // New session
        });

        // Step 4d: Calculate total duration = existing duration + new batch duration
        const existingDuration = eventAttendee.duration || 0;
        const newBatchDuration = batchTotalDuration;
        const totalDuration = existingDuration + newBatchDuration;

        // Step 4e: Check if total duration >= minAttendanceDurationMinutes * 60
        const shouldMarkAttended =
          totalDuration >= minAttendanceDurationSeconds;

        // Step 4f: Update eventAttendee
        eventAttendee.duration = totalDuration;
        eventAttendee.joinedLeftHistory = [...existingSessions, ...newSessions];
        eventAttendee.isAttended = shouldMarkAttended;

        attendeesToPersist.push(eventAttendee);
        updatedAttendeeRecords++;

        // Update statistics
        participantsProcessed += participantSessions.length;
        if (shouldMarkAttended) {
          participantsAttended += participantSessions.length;
        } else {
          participantsNotAttended += participantSessions.length;
        }

        // Call LMS service for lesson completion if participant attended
        if (shouldMarkAttended && eventAttendee.userId) {
          const lmsCall = this.callLmsLessonCompletion(
            eventInfo.eventId,
            eventAttendee.userId,
            totalDuration,
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
      } catch (error) {
        this.logger.error(
          `Failed to process registrantId ${registrantId}`,
          error,
        );
        participantsProcessed += participantSessions.length;
        participantsNotAttended += participantSessions.length;
      }
    }

    // Step 5: Batch save all updates (single transaction)
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
    uniqueRegistrantIds.length = 0;

    return {
      participantsProcessed,
      participantsAttended,
      participantsNotAttended,
      newAttendeeRecords,
      updatedAttendeeRecords,
    };
  }

  /**
   * Normalizes joinedLeftHistory to array format
   * Handles both old format (single object) and new format (array)
   *
   * @param joinedLeftHistory - The joinedLeftHistory from database (can be object or array)
   * @returns Array of session objects
   */
  private normalizeJoinedLeftHistory(joinedLeftHistory: any): any[] {
    if (!joinedLeftHistory) {
      return [];
    }

    // If it's already an array, return it
    if (Array.isArray(joinedLeftHistory)) {
      return joinedLeftHistory;
    }

    // If it's an object (old format), convert to array
    if (typeof joinedLeftHistory === 'object') {
      // Check if it has properties that indicate it's a session object
      if (
        joinedLeftHistory.joinTime ||
        joinedLeftHistory.leaveTime ||
        joinedLeftHistory.duration !== undefined
      ) {
        return [joinedLeftHistory];
      }
    }

    // Fallback: return empty array
    return [];
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
    // Add 15-minute delay buffer to allow Zoom API to process participant data
    // Zoom API typically takes 5-15 minutes after meeting ends to make participant data available
    const ZOOM_API_PROCESSING_DELAY_MINUTES = 15;
    const cutoffTime = new Date(
      Date.now() - ZOOM_API_PROCESSING_DELAY_MINUTES * 60 * 1000,
    );

    this.logger.log(
      `Querying ended events: Processing meetings that ended at least ${ZOOM_API_PROCESSING_DELAY_MINUTES} minutes ago (cutoff: ${cutoffTime.toISOString()})`,
    );

    const queryBuilder = this.eventRepetitionRepository
      .createQueryBuilder('er')
      .leftJoinAndSelect('er.eventDetail', 'ed')
      .leftJoinAndSelect('er.event', 'e')
      .where('er.endDateTime < :cutoffTime', { cutoffTime })
      .andWhere('ed.eventType = :eventType', { eventType: 'online' })
      .andWhere('er.attendanceMarked = :attendanceMarked', {
        attendanceMarked: false,
      })
      .andWhere('er.onlineDetails IS NOT NULL')
      // Only process events where minAttendanceDurationMinutes is set and > 0
      .andWhere('ed.minAttendanceDurationMinutes IS NOT NULL')
      .andWhere('ed.minAttendanceDurationMinutes > 0');

    const events = await queryBuilder.getMany();

    this.logger.log(
      `Found ${events.length} events ready for processing (ended ${ZOOM_API_PROCESSING_DELAY_MINUTES}+ minutes ago with minAttendanceDurationMinutes configured)`,
    );

    // Log events that were skipped due to missing minAttendanceDurationMinutes
    const allEndedEvents = await this.eventRepetitionRepository
      .createQueryBuilder('er')
      .leftJoinAndSelect('er.eventDetail', 'ed')
      .where('er.endDateTime < :cutoffTime', { cutoffTime })
      .andWhere('ed.eventType = :eventType', { eventType: 'online' })
      .andWhere('er.attendanceMarked = :attendanceMarked', {
        attendanceMarked: false,
      })
      .andWhere('er.onlineDetails IS NOT NULL')
      .getMany();

    const skippedEvents = allEndedEvents.filter(
      (event) =>
        !event.eventDetail?.minAttendanceDurationMinutes ||
        event.eventDetail.minAttendanceDurationMinutes === 0,
    );

    if (skippedEvents.length > 0) {
      this.logger.warn(
        `⚠️ Skipped ${skippedEvents.length} event(s) due to missing or invalid minAttendanceDurationMinutes. Event IDs: ${skippedEvents.map((e) => e.eventRepetitionId).join(', ')}`,
      );
      this.logger.warn(
        `Please set minAttendanceDurationMinutes > 0 in EventDetails table for these events to enable attendance processing.`,
      );
    }

    return events;
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


        if (Array.isArray(rawResult)) {
          // Check if it's an array of arrays (nested structure)
          if (rawResult.length > 0 && Array.isArray(rawResult[0])) {
            // Flatten nested arrays
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


      } catch (error) {
        this.logger.error(`Error calling media API: ${error.message}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
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
        return null;
      }


      // Extract mediaId - handle different property names
      const mediaId = media.mediaId || media.media_id || media.id;
      if (!mediaId) {
        this.logger.warn(
          `Media found but no mediaId for source ${eventId}. Media object keys: ${Object.keys(media).join(', ')}. Full object: ${JSON.stringify(media)}`,
        );
        return null;
      }


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

        if (
          rawLessonsResult?.lessons &&
          Array.isArray(rawLessonsResult.lessons)
        ) {
          lessons = rawLessonsResult.lessons;
        } else if (Array.isArray(rawLessonsResult)) {
          lessons = rawLessonsResult;
        } else if (
          rawLessonsResult?.items &&
          Array.isArray(rawLessonsResult.items)
        ) {
          lessons = rawLessonsResult.items;
        } else if (Array.isArray(lessonsResponse.data)) {
          lessons = lessonsResponse.data;
        }

        // Flatten recursively if needed (same as media)
        lessons = this.flattenArray(lessons);


        // Log response structure for debugging if no lessons found
        if (lessons.length === 0) {
          this.logger.warn(
            `Lessons API response structure (first 500 chars): ${JSON.stringify(lessonsResponse.data).substring(0, 500)}`,
          );
        }
      } catch (error) {
        this.logger.error(`Error calling lessons API: ${error.message}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
        return null;
      }

      // Find lesson with matching mediaId
      const lesson = lessons.find(
        (l: any) =>
          l.mediaId === mediaId ||
          l.media_id === mediaId ||
          (l.media &&
            (l.media.mediaId === mediaId || l.media.media_id === mediaId)),
      );

      if (!lesson) {
        this.logger.warn(
          `No lesson found for mediaId ${mediaId} in ${lessons.length} lessons`,
        );
        // Log sample lesson mediaIds for debugging
        return null;
      }


      // Extract lessonId - handle different property names
      const lessonId = lesson.lessonId || lesson.lesson_id || lesson.id;
      if (!lessonId) {
        this.logger.warn(
          `Lesson found but no lessonId for mediaId ${mediaId}. Lesson object keys: ${Object.keys(lesson).join(', ')}. Full object: ${JSON.stringify(lesson)}`,
        );
        return null;
      }

      return lessonId;
    } catch (error) {
      this.logger.error(`Error getting lessonId from eventId ${eventId}`, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
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
      return await this.callLmsLessonCompletion(
        eventId,
        userId,
        timeSpent,
        authToken,
      );
    } catch (error) {
      // Check if error is 404 (Tracking not found)
      const errorStatus = error.response?.status;
      const errorData = error.response?.data;
      const errorMessage =
        errorData?.params?.errmsg || errorData?.message || error.message;

      if (
        errorStatus === 404 &&
        (errorMessage.includes('Tracking not found') ||
          errorMessage.includes('TRACKING_NOT_FOUND') ||
          errorMessage.includes('Lesson track'))
      ) {
        this.logger.log(
          `[${apiId}] Lesson track not found for eventId ${eventId}, userId ${userId}. Attempting to create lesson track entry...`,
        );

        try {
          // Step 1: Get lessonId from eventId
          const lessonId = await this.getLessonIdFromEventId(
            eventId,
            authToken,
          );

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
          const retryResult = await this.callLmsLessonCompletion(
            eventId,
            userId,
            timeSpent,
            authToken,
          );

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
      // IMPORTANT: Only update records that match eventId + eventRepetitionId + userId exactly
      // Do NOT create new entries if no match is found
      this.logger.log(
        `[${apiId}] Step 3: Updating EventAttendees table (only updating existing records matching eventId + eventRepetitionId + userId)...`,
      );

      // Find existing attendees that match ALL THREE: eventId + eventRepetitionId + userId
      const existingAttendees = await this.eventAttendeesRepository.find({
        where: {
          eventId: markAttendanceByUsernameDto.eventId,
          eventRepetitionId: markAttendanceByUsernameDto.eventRepetitionId,
          userId: In(markAttendanceByUsernameDto.userIds),
        },
      });

      this.logger.log(
        `[${apiId}] Found ${existingAttendees.length} existing attendee records matching eventId + eventRepetitionId + userId for ${markAttendanceByUsernameDto.userIds.length} userIds`,
      );

      const attendeesToUpdate: EventAttendees[] = [];
      let updatedAttendeeRecords = 0;
      let skippedRecords = 0;

      for (const userId of markAttendanceByUsernameDto.userIds) {
        // Find existing record that matches ALL THREE criteria: eventId + eventRepetitionId + userId
        const eventAttendee = existingAttendees.find(
          (att) => 
            att.userId === userId &&
            att.eventId === markAttendanceByUsernameDto.eventId &&
            att.eventRepetitionId === markAttendanceByUsernameDto.eventRepetitionId,
        );

        if (eventAttendee) {
          // Update existing record that matches all three criteria
          this.logger.log(
            `[${apiId}] Updating existing EventAttendee record for userId: ${userId}, eventAttendeesId: ${eventAttendee.eventAttendeesId}`,
          );
          eventAttendee.isAttended = true;
          eventAttendee.duration = timeSpent;
          
          // Handle joinedLeftHistory - convert to array format if needed
          let existingHistory = eventAttendee.joinedLeftHistory;
          if (!Array.isArray(existingHistory)) {
            // Convert old object format to array
            existingHistory = existingHistory ? [existingHistory] : [];
          }
          
          // Add new session to history
          const newSession = {
            joinTime: now,
            leaveTime: now,
            duration: timeSpent,
            status: 'attended',
            lastUpdated: now,
          };
          existingHistory.push(newSession);
          eventAttendee.joinedLeftHistory = existingHistory;
          
          eventAttendee.updatedAt = new Date();
          eventAttendee.updatedBy = loggedInUserId;
          attendeesToUpdate.push(eventAttendee);
          updatedAttendeeRecords++;
        } else {
          // Skip if no exact match found - do NOT create new entry
          this.logger.log(
            `[${apiId}] Skipping userId: ${userId} - No existing record found matching eventId (${markAttendanceByUsernameDto.eventId}) + eventRepetitionId (${markAttendanceByUsernameDto.eventRepetitionId}) + userId (${userId})`,
          );
          skippedRecords++;
        }
      }

      // Save updates only (no new entries created)
      if (attendeesToUpdate.length > 0) {
        await this.eventAttendeesRepository.save(attendeesToUpdate);
        this.logger.log(
          `[${apiId}] Successfully updated ${updatedAttendeeRecords} EventAttendee records in database`,
        );
      }

      const totalAttendeesProcessed = updatedAttendeeRecords;
      if (totalAttendeesProcessed === 0) {
        this.logger.warn(
          `[${apiId}] No EventAttendee records were updated. ${skippedRecords} userIds were skipped (no matching records found).`,
        );
      } else if (skippedRecords > 0) {
        this.logger.log(
          `[${apiId}] Updated ${updatedAttendeeRecords} records, skipped ${skippedRecords} userIds (no matching records found).`,
        );
      }

      // Step 4: Skip Attendance Service call (bypassed as per requirement)
      this.logger.log(
        `[${apiId}] Step 4: Skipping Attendance Service call (bypassed)...`,
      );
      this.logger.log(
        `[${apiId}] Attendance marking in Attendance Service is bypassed for this API`,
      );

      // Step 5: Mark lesson completion in LMS Service (only for users whose EventAttendees were updated)
      // Same logic as markAttendance API - only call LMS for users who were successfully marked as attended
      const processedUserIds = attendeesToUpdate.map(
        (att) => att.userId,
      );
      this.logger.log(
        `[${apiId}] Step 5: Marking lesson completion in LMS Service for ${processedUserIds.length} users (only for users with EventAttendees updated)...`,
      );

      const lmsServiceCalls: Promise<any>[] = [];
      const LMS_BATCH_SIZE = 50;
      let lmsSuccessCount = 0;
      let lmsFailureCount = 0;

      // Only call LMS for users whose EventAttendees were successfully updated (no new entries created)
      for (const eventAttendee of attendeesToUpdate) {
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
        eventAttendeesSkipped: skippedRecords,
        totalEventAttendeesProcessed: updatedAttendeeRecords,
        attendanceMarked: 'bypassed', // Attendance Service call is bypassed
        lmsLessonCompletion: {
          total: updatedAttendeeRecords, // Only count successfully updated records
          success: lmsSuccessCount,
          failed: lmsFailureCount,
        },
        processingTimeMs,
        userIds: markAttendanceByUsernameDto.userIds,
        note: 'EventAttendees table updated (only existing records matching eventId + eventRepetitionId + userId), Attendance Service call bypassed, LMS lesson completion marked',
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
