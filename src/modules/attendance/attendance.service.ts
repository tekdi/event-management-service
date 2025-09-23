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
import { MarkMeetingAttendanceDto, MarkAttendanceDto } from './dto/markAttendance.dto';
import {
  API_ID,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  testIds,
} from 'src/common/utils/constants.util';
import { OnlineMeetingAdapter } from 'src/online-meeting-adapters/onlineMeeting.adapter';
import { AttendanceRecord, UserDetails } from 'src/common/utils/types';
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
  /** Total number of participants in the event */
  totalParticipants: number;
  /** Number of participants processed during this run */
  participantsProcessed: number;
  /** Number of participants who attended the event */
  participantsAttended: number;
  /** Number of participants who did not attend the event */
  participantsNotAttended: number;
  /** Number of new attendee records created */
  newAttendeeRecords: number;
  /** Number of existing attendee records updated */
  updatedAttendeeRecords: number;
  /** Pagination token for next page (null if no more pages) */
  nextPageToken: string | null;
  /** Pagination information */
  pagination: {
    /** Total number of pages in the participant list */
    totalPages: number;
    /** Current page number (0-based) */
    currentPage: number;
    /** Whether there are more pages to process */
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
    pageSize: number = 300,
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
        (eventRepetition.onlineDetails as any).id,
        markMeetingAttendanceDto.markAttendanceBy,
        (eventRepetition.onlineDetails as any).meetingType,
        pageSize,
      );

   

    if (
      !this.attendanceServiceUrl.trim().length
    ) {
      // match EventAttendees.registrantId with participantIdentifiers.inMeetingUserDetails.registrant_id and mark isAttended as true and duration and joinedLeftHistory as participant details
      const registrantIds = participantIdentifiers.inMeetingUserDetails
        .map((participant) => participant.registrant_id)
        .filter((id) => id); // Filter out any undefined/null values

      if (registrantIds.length > 0) {
        // Update each attendee record individually with their specific attendance data
        for (const participant of participantIdentifiers.inMeetingUserDetails) {
          if (participant.registrant_id) {
            await this.eventAttendeesRepository.update(
              {
                registrantId: participant.registrant_id,
                eventRepetitionId: markMeetingAttendanceDto.eventRepetitionId,
              },
              {
                isAttended: true,
                duration: participant.duration,
                joinedLeftHistory: {
                  joinTime: participant.join_time,
                  leaveTime: participant.leave_time,
                  status: participant.status,
                } as any,
              },
            );
          }
        }

        return response.status(HttpStatus.CREATED).json(
          APIResponse.success(
            apiId,
            {          
              next_page_token: participantIdentifiers.next_page_token,
              page_count: participantIdentifiers.page_count,
              page_size: participantIdentifiers.page_size,
              total_records: participantIdentifiers.total_records,
            },
            SUCCESS_MESSAGES.ATTENDANCE_MARKED_FOR_MEETING,
          ),
        );     
      }
    }


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
    let res = await this.markUsersAttendance(
      userDetailList,
      markMeetingAttendanceDto,
      userId,
      authToken,
    );
    res = {
      ...res,
      next_page_token: participantIdentifiers.next_page_token,
      page_count: participantIdentifiers.page_count,
      page_size: participantIdentifiers.page_size,
      total_records: participantIdentifiers.total_records,
    };

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
    dto: MarkAttendanceDto,
    userId: string,
    response: Response,
    authToken: string
  ): Promise<Response> {
    const startTime = Date.now();
    const errors: string[] = [];
    const eventResults: any[] = [];

    try {
      // Process all ended events with resumability support
      const result = await this.processAllEndedEventsWithResumability(dto, authToken, startTime, userId);
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
    dto: MarkAttendanceDto,
    authToken: string,
    startTime: number,
    userId: string
  ): Promise<any> {
    const errors: string[] = [];
    const eventResults: any[] = [];

    // Get events that need attendance marking
    const eventsToProcess = await this.getEndedEventsForAttendanceMarking(dto);
    
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
        message: 'No ended events found for attendance marking'
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
          attendanceMarked: event.attendanceMarked
        };

        // Skip if already processed and not forcing reprocess
        if (!dto.forceReprocess && eventInfo.attendanceMarked) {
          this.logger.log(`Event ${eventInfo.eventRepetitionId} already processed, skipping`);
          continue;
        }

        // Process the event with checkpoint support
        const result = await this.processEventWithSimpleCheckpoint(
          eventInfo,
          dto,
          authToken
        );

        // Only mark as completed if all participants processed AND no more pages
        const isFullyCompleted = !result.pagination.hasNextPage || 
                                result.participantsProcessed === result.totalParticipants;

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
          processingTimeMs: 0
        });

        totalEventsProcessed++;
        if (isFullyCompleted) {
          successfulEvents++;
          // Mark event as completed only when fully done
          await this.markEventAttendanceCompleted(eventInfo.eventRepetitionId, result.participantsProcessed);
        } else {
          // Event partially processed - will be resumed later
          this.logger.log(`Event ${eventInfo.eventRepetitionId} partially processed: ${result.participantsProcessed}/${result.totalParticipants} participants`);
        }
        totalParticipantsProcessed += result.participantsProcessed;

      } catch (error) {
        this.logger.error(`Failed to process event ${event.eventRepetitionId}`, error);
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
          processingTimeMs: 0
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
      message: `Processed ${totalEventsProcessed} events successfully`
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
    dto: MarkAttendanceDto,
    authToken: string
  ): Promise<ProcessingResult> {
    // Check if checkpoint exists
    let checkpoint = await this.checkpointService.loadCheckpoint(eventInfo.eventRepetitionId);
    
    if (checkpoint && !dto.forceReprocess) {
      this.logger.log(`Resuming event ${eventInfo.eventRepetitionId} from checkpoint`);
      return await this.resumeEventFromCheckpoint(eventInfo, dto, authToken, checkpoint);
    }

    // Create new checkpoint
    checkpoint = await this.checkpointService.createCheckpoint(
      eventInfo.eventRepetitionId,
      eventInfo.eventId,
      eventInfo.zoomId
    );

    // Process the event
    const result = await this.processEventParticipants(eventInfo, dto, authToken, checkpoint);

    // Only clean up checkpoint if event is fully completed
    const isFullyCompleted = !result.pagination.hasNextPage && 
                            result.participantsProcessed === result.totalParticipants;
    
    if (isFullyCompleted) {
      await this.checkpointService.deleteCheckpoint(eventInfo.eventRepetitionId);
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
    dto: MarkAttendanceDto,
    authToken: string,
    checkpoint: SimpleCheckpoint
  ): Promise<ProcessingResult> {
    this.logger.log(`Resuming event ${eventInfo.eventRepetitionId} from page ${checkpoint.currentPage}`);
    return await this.processEventParticipants(eventInfo, dto, authToken, checkpoint);
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
    dto: MarkAttendanceDto,
    authToken: string,
    checkpoint: SimpleCheckpoint
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
              ''
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
          this.logger.error(`Failed to get initial participant list for event ${eventInfo.eventRepetitionId}`, error);
          throw new Error(`Failed to fetch participants for event ${eventInfo.eventRepetitionId}: ${error.message}`);
        }

        // Process participants from the initial response
        const result = await this.processParticipantBatch(
          initialResponse.participants,
          eventInfo,
          dto,
          authToken
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
              `&next_page_token=${nextPageToken}`
            );

          const result = await this.processParticipantBatch(
            participantResponse.participants,
            eventInfo,
            dto,
            authToken
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

        } catch (error) {
          this.logger.error(`Failed to process page ${currentPage} for event ${eventInfo.eventRepetitionId}`, error);
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
          totalPages: Math.ceil(totalParticipants / dto.pageSize),
          currentPage: currentPage - 1,
          hasNextPage: !!nextPageToken // true if there are more pages
        }
      };

    } catch (error) {
      this.logger.error(`Failed to process participants for event ${eventInfo.eventRepetitionId}`, error);
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
    dto: MarkAttendanceDto,
    authToken: string
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
  
    const registrantIds = participants.map(p => p.registrant_id).filter(Boolean);
  
    if (!registrantIds.length) {
      return {
        participantsProcessed: 0,
        participantsAttended: 0,
        participantsNotAttended: 0,
        newAttendeeRecords: 0,
        updatedAttendeeRecords: 0
      };
    }
  
    const existingAttendees = await this.eventAttendeesRepository.findBy({
      eventRepetitionId: eventInfo.eventRepetitionId,
      registrantId: In(registrantIds),
    });
  
    const attendeeMap = new Map(
      existingAttendees.map(att => [att.registrantId, att])
    );
  
    const attendeesToPersist: EventAttendees[] = [];
    const now = new Date().toISOString();
    const lmsServiceCalls: Promise<any>[] = [];
  
    for (const participant of participants) {
      try {
        const identifier = participant.registrant_id;
        if (!identifier) {
          this.logger.warn(`Participant ${participant.id} missing registrant_id, skipping`);
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
          lastUpdated: now
        };

        attendeesToPersist.push(eventAttendee);
        // Call LMS service for lesson completion if participant attended
          const lmsCall = this.callLmsLessonCompletion(
            eventInfo.eventId,
            eventAttendee.userId,
            participant.duration || 0,
            authToken
          ).catch(error => {
            this.logger.error(`Failed to call LMS service for user ${eventAttendee.userId}`, error);
            return null; // Don't fail the entire process if LMS call fails
          });
          lmsServiceCalls.push(lmsCall);
        }
  
        participantsProcessed++;
        eventAttendee.isAttended ? participantsAttended++ : participantsNotAttended++;
      } catch (error) {
        this.logger.error(`Failed to process participant ${participant.id}`, error);
        participantsProcessed++;
        participantsNotAttended++;
      }
    }
  
    if (attendeesToPersist.length > 0) {
      await this.eventAttendeesRepository.save(attendeesToPersist);
    }

    // Wait for all LMS service calls to complete
    if (lmsServiceCalls.length > 0) {
      await Promise.allSettled(lmsServiceCalls);
    }
  
    return {
      participantsProcessed,
      participantsAttended,
      participantsNotAttended,
      newAttendeeRecords,
      updatedAttendeeRecords
    };
  }
  


  private async markEventAttendanceCompleted(
    eventRepetitionId: string,
    participantsProcessed: number
  ): Promise<void> {
    await this.eventRepetitionRepository.update(
      { eventRepetitionId },
      {
        attendanceMarked: true,
        totalParticipantsProcessed: participantsProcessed
      }
    );
    await this.checkpointService.deleteCheckpoint(eventRepetitionId);
  }

  private async getEndedEventsForAttendanceMarking(
    dto: MarkAttendanceDto
  ): Promise<EventRepetition[]> {
    const queryBuilder = this.eventRepetitionRepository
      .createQueryBuilder('er')
      .leftJoinAndSelect('er.eventDetail', 'ed')
      .leftJoinAndSelect('er.event', 'e')
      .where('er.endDateTime < :currentTime', { currentTime: new Date() })
      .andWhere('ed.eventType = :eventType', { eventType: 'online' })
      .andWhere('er.attendanceMarked = :attendanceMarked', { attendanceMarked: false })
      .andWhere('er.onlineDetails IS NOT NULL');

    return queryBuilder.getMany();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private sendSuccessResponse(response: Response, data: any): Response {
    return response.status(HttpStatus.OK).json(
      APIResponse.success(
        data,
        SUCCESS_MESSAGES.ATTENDANCE_MARKED_FOR_MEETING,
        API_ID.MARK_ATTENDANCE,
      ),
    );
  }

  private sendErrorResponse(response: Response, message: string): Response {
    return response.status(HttpStatus.BAD_REQUEST).json(
      APIResponse.error(
        message,
        API_ID.MARK_ATTENDANCE,
        '400',
        'Bad Request'
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
    authToken: string
  ): Promise<any> {
    try {
      const lmsServiceUrl = this.configService.get('LMS_SERVICE_URL');
      const tenantId = this.configService.get('TENANT_ID');
      const organisationId = this.configService.get('ORGANISATION_ID');
      
      if (!lmsServiceUrl) {
        this.logger.warn('LMS_SERVICE_URL not configured, skipping lesson completion call');
        return null;
      }

      const response = await this.httpService.axiosRef.patch(
        `${lmsServiceUrl}/v1/tracking/event/${eventId}`,
        {
          userId,
          status: 'completed',
          timeSpent: Math.floor(timeSpent) // Convert to integer seconds
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken,
            'tenantid': tenantId,
            'organisationid': organisationId
          },
        }
      );

      this.logger.log(`Successfully marked lesson completion for user ${userId} in event ${eventId}`);
      return response.data;

    } catch (error) {
      this.logger.error(`Failed to call LMS service for event ${eventId}, user ${userId}`, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }
  }
