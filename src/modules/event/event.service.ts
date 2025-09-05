import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
  NotImplementedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateEventDto, RecurrencePatternDto } from './dto/create-event.dto';
import { UpdateEventDto, UpdateResult } from './dto/update-event.dto';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  In,
  Not,
  MoreThan,
  MoreThanOrEqual,
  LessThanOrEqual,
  Between,
  DeleteResult,
  InsertResult,
} from 'typeorm';
import { Events } from './entities/event.entity';
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { EventDetail } from './entities/eventDetail.entity';
import {
  API_ID,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from 'src/common/utils/constants.util';
import { EventRepetition } from './entities/eventRepetition.entity';
import {
  DaysOfWeek,
  EndConditionType,
  EventTypes,
  Frequency,
  RecurrencePattern,
  RepetitionDetail,
  MeetingType,
  ApprovalType,
  OnlineDetails,
} from 'src/common/utils/types';
import { ConfigService } from '@nestjs/config';
import {
  DateValidationPipe,
  RecurringEndDateValidationPipe,
} from 'src/common/pipes/event-validation.pipe';
import { compareArrays } from 'src/common/utils/functions.util';
import * as moment from 'moment-timezone';
import { LoggerWinston } from 'src/common/logger/logger.util';
import { OnlineMeetingAdapter } from 'src/online-meeting-adapters/onlineMeeting.adapter';
import { CreateMeetingRequest } from 'src/online-meeting-adapters/onlineMeeting.locator';

// Extend the existing UpdateResult interface
declare module 'src/modules/event/dto/update-event.dto' {
  interface UpdateResult {
    zoomApiUpdated?: boolean;
    zoomApiError?: string;
  }
}

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);
  private readonly eventCreationLimit: number;
  private readonly timezone: string;

  constructor(
    @InjectRepository(Events)
    private readonly eventRepository: Repository<Events>,
    @InjectRepository(EventDetail)
    private readonly eventDetailRepository: Repository<EventDetail>,
    @InjectRepository(EventRepetition)
    private readonly eventRepetitionRepository: Repository<EventRepetition>,
    private readonly configService: ConfigService,
    private readonly onlineMeetingAdapter: OnlineMeetingAdapter,
  ) {
    this.eventCreationLimit = this.configService.get<number>(
      'EVENT_CREATION_LIMIT',
    );
    this.timezone = this.configService.get<string>('TIMEZONE');
  }

  /**
   * Validate privacy requirements based on event properties
   * Now controlled at event level via createEventDto.isMeetingNew and other properties
   */
  private async validatePrivacyRequirements(
    createEventDto: CreateEventDto,
  ): Promise<void> {
    // Apply validation rules based on event properties

    if (createEventDto.isRestricted === true) {
      // Private Event Validation
      if (createEventDto.platformIntegration === false) {
        // Using existing meeting: Strict validation - invitees are required
        if (
          !createEventDto.attendees ||
          createEventDto.attendees.length === 0
        ) {
          throw new BadRequestException(
            'Private events using existing meetings require invitees. Please add attendees to the event.',
          );
        }
      }
      // If isMeetingNew === true: No strict validation (focus on meeting creation)
    } else if (createEventDto.isRestricted === false) {
      // Public Event Validation
      if (createEventDto.platformIntegration === false) {
        // Using existing meeting: Strict validation - registration dates are required
        if (
          !createEventDto.registrationStartDate ||
          !createEventDto.registrationEndDate
        ) {
          throw new BadRequestException(
            'Public events using existing meetings require registration start and end dates. Please provide registrationStartDate and registrationEndDate.',
          );
        }
      }
    }
  }

  async createEvent(
    createEventDto: CreateEventDto,
    response: Response,
  ): Promise<Response> {
    const apiId = API_ID.CREATE_EVENT;
    this.validateTimezone();

    // Validate privacy requirements based on service mode
    await this.validatePrivacyRequirements(createEventDto);

    // true for private, false for public
    let createdEvent: any = {};
    if (createEventDto.isRestricted === true) {
      // private event
      createdEvent = await this.createOfflineOrOnlineEvent(createEventDto);

      // if event is private then invitees are required
      // add invitees to attendees table

      // await this.attendeesService.createAttendeesForRecurringEvents(
      //   createEventDto.attendees,
      //   createdEvent.res.eventId,
      //   createdEvent.eventRepetitionIds,
      //   createEventDto.createdBy,
      // );

      // TODO: new approach of adding attendees
      // await this.attendeesService.createAttendeesForEvents(
      //   createEventDto.attendees,
      //   createdEvent.res.eventId,
      //   createEventDto.createdBy,
      // );
    } else {
      // throw new NotImplementedException(ERROR_MESSAGES.PUBLIC_EVENTS);
      // TODO: if event is public then registrationDate is required
      // if (createEventDto.eventType === 'online') {
      // create online event
      // this.createOnlineEvent(createEventDto);
      // } else if (createEventDto.eventType === 'offline') {
      // create offline event
      // this.createOfflineEvent(createEventDto);
      // }

      // Public event handling - supported in both modes
      createdEvent = await this.createOfflineOrOnlineEvent(createEventDto);
    }

    LoggerWinston.log(
      SUCCESS_MESSAGES.EVENT_CREATED_LOG(createdEvent.res?.eventId),
      apiId,
      createEventDto.createdBy,
    );

    return response
      .status(HttpStatus.CREATED)
      .json(APIResponse.success(apiId, createdEvent.res, 'Created'));
  }

  async getEvents(response, requestBody, userId: string) {
    const apiId = API_ID.GET_EVENTS;
    this.validateTimezone();

    const { filters } = requestBody;
    const today = new Date();

    let finalquery = `SELECT 
      er."eventDetailId" AS "eventRepetition_eventDetailId", 
      er."createdBy" AS "eventRepetition_createdBy",
      er.*, 
      e."eventId" AS "event_eventId", 
      e."eventDetailId" AS "event_eventDetailId",
      e.*, 
      ed."eventDetailId" AS "eventDetail_eventDetailId",
      ed.*, 
      COUNT(*) OVER() AS total_count
      FROM public."EventRepetition"  AS er
      LEFT JOIN "EventDetails" AS ed ON er."eventDetailId"=ed."eventDetailId" 
      LEFT JOIN "Events" AS e ON er."eventId"=e."eventId"`;

    //User not pass any things then it show today and upcoming event
    if (!filters || Object.keys(filters).length === 0) {
      finalquery += ` WHERE (er."startDateTime" >= CURRENT_TIMESTAMP
        OR er."endDateTime" > CURRENT_TIMESTAMP) AND ed.status='live'`;
    }

    // if user pass somthing in filter then make query
    if (filters && Object.keys(filters).length > 0) {
      finalquery = await this.createSearchQuery(filters, finalquery);
    }

    // Set default limit and offset if not provided
    const limit = requestBody.limit ? requestBody.limit : 200;
    const offset = requestBody.offset ? requestBody.offset : 0;

    // Append LIMIT and OFFSET to the query
    finalquery += ` LIMIT ${limit} OFFSET ${offset}`;

    const result = await this.eventRepetitionRepository.query(finalquery);
    const totalCount = result[0]?.total_count;

    // Add isEnded key based on endDateTime
    const finalResult = result.map((event) => {
      delete event.total_count;

      const endDateTime = new Date(event.endDateTime);
      // isEnded to be shown when time of event is passed
      return {
        ...event,
        isEnded: endDateTime < today,
      };
    });
    if (finalResult.length === 0) {
      throw new NotFoundException(ERROR_MESSAGES.EVENT_NOT_FOUND);
    }
    LoggerWinston.log(SUCCESS_MESSAGES.EVENTS_FETCHED_LOG, apiId, userId);
    return response
      .status(HttpStatus.OK)
      .json(
        APIResponse.success(apiId, { totalCount, events: finalResult }, 'OK`'),
      );
  }

  async createSearchQuery(filters, finalquery) {
    const whereClauses = [];

    // Handle specific date records
    if (filters?.date) {
      const startDateTime = filters?.date.after; // min date
      const endDateTime = filters?.date.before; // max date ---> seraching on the basis of max date
      whereClauses.push(
        `(er."startDateTime" <= '${endDateTime}'::timestamp AT TIME ZONE 'UTC' AND er."endDateTime" >= '${startDateTime}'::timestamp AT TIME ZONE 'UTC')`,
      );
    }

    // Handle startDate
    if (filters?.startDate && filters.endDate === undefined) {
      const startDateTime = filters.startDate.after;
      const endDateTime = filters.startDate.before;

      whereClauses.push(
        `(er."startDateTime" <= '${endDateTime}' ::timestamp AT TIME ZONE 'UTC' AND er."startDateTime" >= '${startDateTime}' ::timestamp AT TIME ZONE 'UTC')`,
      );
    }

    if (filters?.startDate && filters.endDate) {
      const startDateTime = filters.startDate.after; // 21 -> startDate
      const endDateTime = filters.endDate.before;

      whereClauses.push(
        `(er."startDateTime" <= '${endDateTime}' ::timestamp AT TIME ZONE 'UTC' AND er."endDateTime" >= '${startDateTime}' ::timestamp AT TIME ZONE 'UTC')`,
      );
    }

    if (filters.endDate && filters.startDate === undefined) {
      const startDateTime = filters.endDate.after;
      const endDateTime = filters.endDate.before;
      whereClauses.push(
        `(er."endDateTime" <= '${endDateTime}' ::timestamp AT TIME ZONE 'UTC' AND er."endDateTime" >= '${startDateTime}' ::timestamp AT TIME ZONE 'UTC')`,
      );
    }

    // Handle eventType filter
    if (filters.eventType && filters.eventType.length > 0) {
      const eventTypeConditions = filters.eventType
        .map((eventType) => `ed."eventType" = '${eventType}'`)
        .join(' OR ');
      whereClauses.push(`(${eventTypeConditions})`);
    }
    // Handle title filter with ILIKE
    if (filters.title) {
      const titleSearch = `%${filters.title}%`;
      whereClauses.push(`ed."title" ILIKE '${titleSearch}'`);
    }

    // Handle status filter
    if (filters?.status && filters?.status.length > 0) {
      const statusConditions = filters.status
        .map((status) => `ed."status" = '${status}'`)
        .join(' OR ');
      whereClauses.push(`(${statusConditions})`);
    } else {
      // Add default status condition if no status is passed in the filter
      whereClauses.push(`ed."status" = 'live'`);
    }

    // Handle cohortId filter
    if (filters?.cohortId) {
      whereClauses.push(`ed."metadata"->>'cohortId'='${filters.cohortId}'`);
    }

    if (filters.hasOwnProperty('attendanceMarked')) {
      whereClauses.push(
        `er."onlineDetails"->>'attendanceMarked'='${filters?.attendanceMarked}'`,
      );
    }

    if (filters?.createdBy) {
      whereClauses.push(`er."createdBy" = '${filters.createdBy}'`);
    }

    // Construct final query
    if (whereClauses.length > 0) {
      finalquery += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    return finalquery;
  }

  async updateEvent(
    eventRepetitionId: string,
    updateBody: UpdateEventDto,
    response: Response,
  ) {
    const apiId = API_ID.UPDATE_EVENT;
    this.validateTimezone();
    if (!(this.eventCreationLimit > 0)) {
      throw new BadRequestException(ERROR_MESSAGES.CREATION_LIMIT_UNAVAILABLE);
    }

    const where = {};
    if (updateBody?.onlineDetails?.attendanceMarked) {
      const allowedKeys = ['isMainEvent', 'onlineDetails', 'updatedBy'];
      const invalidKeys = Object.keys(updateBody).filter(
        (key) => !allowedKeys.includes(key),
      );

      if (invalidKeys.length > 0) {
        throw new BadRequestException(
          `Invalid keys provided: ${invalidKeys.join(', ')}`,
        );
      }
      where['eventRepetitionId'] = eventRepetitionId;
    } else {
      // Event repetition record must not be of passed date
      const currentTimestamp = new Date();
      where['eventRepetitionId'] = eventRepetitionId;
      where['startDateTime'] = MoreThan(currentTimestamp);
    }

    // To do optimize both cases in one queries
    const eventRepetition = await this.eventRepetitionRepository.findOne({
      where,
    });

    if (!eventRepetition) {
      // when id does not exist or event date is passed
      throw new BadRequestException(ERROR_MESSAGES.EVENT_NOT_FOUND);
    }
    const isEventArchived = await this.getEventDetails(
      eventRepetition.eventDetailId,
    );
    if (isEventArchived.status === 'archived') {
      throw new BadRequestException(ERROR_MESSAGES.CANNOT_EDIT_ARCHIVED_EVENTS);
    }

    const event = await this.findEventById(eventRepetition.eventId);

    // condition for prevent wrong input for recurring event
    if (!event.isRecurring && !updateBody.isMainEvent) {
      // Is main but still passing false for isMainEvent and isRecurring throw error
      throw new BadRequestException(
        ERROR_MESSAGES.CANNOT_PASS_MAIN_EVENT_FALSE,
      );
    }

    const eventDetail = await this.getEventDetails(event.eventDetailId);

    const validationResult = this.isInvalidUpdate(updateBody, eventDetail);
    if (!validationResult.isValid) {
      throw new BadRequestException(validationResult.message);
    }
    let result;
    eventRepetition.updatedAt = new Date();
    eventRepetition.updatedBy = updateBody.updatedBy;
    if (updateBody?.isMainEvent) {
      // Handle updates or deletions for all recurrence records
      result = await this.handleAllEventUpdate(
        updateBody,
        event,
        eventDetail,
        eventRepetition,
      );
    } else {
      // Handle updates or deletions for a specific recurrence record
      result = await this.handleSpecificRecurrenceUpdate(
        updateBody,
        event,
        eventRepetition,
      );
    }

    LoggerWinston.log(
      SUCCESS_MESSAGES.EVENT_UPDATED_LOG,
      apiId,
      updateBody.updatedBy,
    );
    return response
      .status(HttpStatus.OK)
      .json(APIResponse.success(apiId, result, 'OK'));
  }

  async updateRecurringEvents(
    newRecurrencePattern: RecurrencePatternDto,
    oldRecurrencePattern,
    currentEventRepetition,
  ) {
    if (newRecurrencePattern.frequency === Frequency.daily) {
      throw new NotImplementedException(ERROR_MESSAGES.DAILY_FREQUENCY);
    }

    if (
      newRecurrencePattern.endCondition.type === EndConditionType.occurrences
    ) {
      // TODO: Implement end condition by occurrences
      throw new NotImplementedException(
        ERROR_MESSAGES.END_CONDITION_BY_OCCURRENCES,
      );
    }

    const currentDate = new Date();
    const newRecurringStart = newRecurrencePattern.recurringStartDate;
    const nstartDate = newRecurringStart.split('T')[0];
    const newRecStartDate = new Date(newRecurringStart);

    const oldRecurringStart = oldRecurrencePattern.recurringStartDate;
    const ostartDate = oldRecurringStart.split('T')[0];
    const oldRecStartDate = new Date(oldRecurringStart);

    const newRecurringEnd = newRecurrencePattern.endCondition.value;
    const oldRecurringEnd = oldRecurrencePattern.endCondition.value;
    const newRecEndDate = new Date(newRecurringEnd);
    const oldRecEndDate = new Date(oldRecurringEnd);

    if (newRecEndDate < currentDate) {
      throw new BadRequestException(ERROR_MESSAGES.END_DATE_CANNOT_CHANGE);
    }

    if (oldRecEndDate < currentDate) {
      throw new BadRequestException(ERROR_MESSAGES.END_DATE_CANNOT_CHANGE);
    }

    if (newRecStartDate > newRecEndDate) {
      // end date is passed is less than recurring start date
      throw new BadRequestException(
        ERROR_MESSAGES.END_DATE_LESS_THAN_START_DATE,
      );
    }

    const isDateTimeUpdate = this.checkIfDateIsSame(
      newRecurrencePattern.recurringStartDate,
      oldRecurrencePattern.recurringStartDate,
      newRecurrencePattern.endCondition.value,
      oldRecurrencePattern.endCondition.value,
    );

    const isWeekPatternSame = this.checkIfPatternIsSame(
      newRecurrencePattern,
      oldRecurrencePattern,
    );

    if (!isDateTimeUpdate.dateSame || !isWeekPatternSame) {
      // date or pattern is different'
      if (isWeekPatternSame) {
        // new start date is passed
        // if (nstartDate !== ostartDate && oldRecStartDate < currentDate) {
        //   throw new BadRequestException(
        //     'Start Date cannot be changed because it is passed away',
        //   );
        // }

        // Pattern is same but date is different
        // either add or subtract events as pattern is same
        currentEventRepetition['recurrencePattern'] = oldRecurrencePattern;

        if (
          new Date(nstartDate).getTime() === new Date(ostartDate).getTime() && // check only date
          newRecEndDate.getTime() !== oldRecEndDate.getTime()
        ) {
          // start date and time is same
          // changed time of current event will take effect on following events
          // no action on start dates but end date is different

          // end date and time changed
          if (
            newRecEndDate.getTime() > oldRecEndDate.getTime() ||
            newRecEndDate.getTime() < oldRecEndDate.getTime()
          ) {
            // add or remove events and update end date in recpattern
            // and save current event with new time
            return await this.editThisAndFollowingEvents(
              currentEventRepetition,
              oldRecurrencePattern,
              newRecurrencePattern,
            );
          }
        }

        // find out if start date is changed or end date is changed or both are changed
        if (newRecStartDate < currentDate) {
          // not possible because cannot create events in past throw error
          // start date remains same
          throw new BadRequestException(
            ERROR_MESSAGES.CANNOT_PREPONE_PAST_EVENTS,
          );
        } else if (
          (newRecStartDate < oldRecStartDate &&
            newRecStartDate > currentDate) ||
          (newRecStartDate > oldRecStartDate && newRecStartDate > currentDate)
        ) {
          // prepone events when new start date lies between current date and old start date
          // end date does not matter
          // add events fully and update start date in recpattern

          return await this.deleteOldAndRecreateNewEvents(
            currentEventRepetition,
            newRecurrencePattern,
          );
        }
      } else if (oldRecStartDate > currentDate) {
        // Pattern is different- date doesnt matter
        // Frequency and interval are different
        // make start date as end date for old events and create new events
        //  {
        // old start date is greater than current date that means event is in future
        // check newrecurrence startDate should be greater than currentDate

        if (newRecStartDate < currentDate) {
          throw new BadRequestException(
            ERROR_MESSAGES.RECURRENCE_START_DATE_IN_FUTURE,
          );
        }
        return await this.deleteOldAndRecreateNewEvents(
          currentEventRepetition,
          newRecurrencePattern,
        );
      } else {
        // old start date is less than current date that means event started in past

        return await this.editThisAndFollowingEvents(
          currentEventRepetition,
          oldRecurrencePattern,
          newRecurrencePattern,
        );
      }
    } else if (
      !isDateTimeUpdate.timeSame &&
      isDateTimeUpdate.dateSame &&
      isWeekPatternSame
    ) {
      //  just time is different so just update time
      return await this.editThisAndFollowingEvents(
        currentEventRepetition,
        oldRecurrencePattern,
        newRecurrencePattern,
      );
    }
  }

  async createNewEventAndEventDetail(
    eventId,
    eventDetailId,
    newRecurrencePattern,
  ) {
    // Create new event and eventDetail as per details of orignal event
    const oldEvent = await this.findEventById(eventId);

    oldEvent.eventId = undefined; // so that new event is created and new id is generated for it
    oldEvent.createdAt = new Date();
    oldEvent.updatedAt = new Date();

    const oldEventDetail = await this.getEventDetails(eventDetailId);
    oldEventDetail.eventDetailId = undefined; // so that new eventDetail is created and new id is generated for it
    oldEventDetail.createdAt = new Date();
    oldEventDetail.updatedAt = new Date();

    const newEventDetail =
      await this.eventDetailRepository.save(oldEventDetail);
    oldEvent.eventDetailId = newEventDetail.eventDetailId;
    oldEvent.recurrencePattern = newRecurrencePattern;
    const newEvent = await this.eventRepository.save(oldEvent);

    return { newEvent, newEventDetail };
  }

  async updateEventRepetitionPattern(eventId, repetitionPattern) {
    return await this.eventRepository.update(
      {
        eventId,
      },
      {
        recurrencePattern: repetitionPattern,
        updatedAt: new Date(),
      },
    );
  }

  async deleteOldAndRecreateNewEvents(
    currentEventRepetition,
    newRecurrencePattern,
  ) {
    // delete old events associated with the eventId
    const removedEvents = await this.eventRepetitionRepository.delete({
      eventId: currentEventRepetition.eventId,
    });
    currentEventRepetition['recurrencePattern'] = newRecurrencePattern;
    currentEventRepetition['startDatetime'] =
      newRecurrencePattern.recurringStartDate;
    currentEventRepetition['endDatetime'] =
      currentEventRepetition['startDatetime'].split('T')[0] +
      'T' +
      currentEventRepetition.endDatetime.split('T')[1];

    currentEventRepetition.updatedAt = new Date();

    // create new events
    const newlyAddedEvents = await this.createRecurringEvents(
      currentEventRepetition,
      currentEventRepetition.eventId,
      currentEventRepetition.eventDetailId,
      true,
    );

    await this.updateEventRepetitionPattern(
      currentEventRepetition.eventId,
      currentEventRepetition.recurrencePattern,
    );

    return {
      removedEvents,
      newlyAddedEvents,
      newEvent: currentEventRepetition.eventId,
      newEventDetail: currentEventRepetition.eventDetailId,
    };
  }

  async editThisAndFollowingEvents(
    currentEventRepetition,
    oldRecurrencePattern,
    newRecurrencePattern,
  ) {
    // remove upcoming events
    const removedEvents = await this.removeEventsMoreThanOrEqualToDate(
      currentEventRepetition.startDateTime,
      currentEventRepetition.eventId,
    );

    // update recurrence pattern in which update endDate so that old event ends on new start date
    // set start of new event as end of old event

    oldRecurrencePattern.endCondition.value =
      currentEventRepetition.startDatetime;

    await this.updateEventRepetitionPattern(
      currentEventRepetition.eventId,
      oldRecurrencePattern,
    );

    newRecurrencePattern.recurringStartDate =
      currentEventRepetition.startDatetime;
    currentEventRepetition['recurrencePattern'] = newRecurrencePattern;

    currentEventRepetition['endDatetime'] =
      currentEventRepetition['startDatetime'].split('T')[0] +
      'T' +
      currentEventRepetition.endDatetime.split('T')[1];

    currentEventRepetition.updatedAt = new Date();

    const { newEvent, newEventDetail } =
      await this.createNewEventAndEventDetail(
        currentEventRepetition.eventId,
        currentEventRepetition.eventDetailId,
        newRecurrencePattern,
      );

    currentEventRepetition.eventId = newEvent.eventId;
    currentEventRepetition.eventDetailId = newEventDetail.eventDetailId;

    const newlyAddedEvents = await this.createRecurringEvents(
      currentEventRepetition,
      currentEventRepetition.eventId,
      currentEventRepetition.eventDetailId,
      true,
    );
    return {
      removedEvents,
      newlyAddedEvents,
      newEvent: newEvent,
      newEventDetail: newEventDetail,
    };
  }

  async updateEventRepetitionTime(
    fromDate,
    toDate,
    eventIds,
    newStartTime,
    newEndTime,
  ) {
    return await this.eventRepetitionRepository.update(
      {
        eventId: In(eventIds), // Filters by eventIds
        startDateTime: Between(fromDate, toDate), // Filters by startTime range
      },
      {
        // Update the time portion of startTime while keeping the date intact
        startDateTime: () =>
          `TO_TIMESTAMP(TO_CHAR(startDateTime, 'YYYY-MM-DD') || ' ${newStartTime}', 'YYYY-MM-DD HH24:MI:SS')`,
        endDateTime: () =>
          `TO_TIMESTAMP(TO_CHAR(endDateTime, 'YYYY-MM-DD') || ' ${newEndTime}', 'YYYY-MM-DD HH24:MI:SS')`,
      },
    );
  }

  async updateEventRepetition(recurrenceRecords: EventRepetition[], set) {
    return await this.eventRepetitionRepository.update(
      {
        eventRepetitionId: In(
          recurrenceRecords.map((record) => record.eventRepetitionId),
        ),
      },
      set,
    );
  }

  async removeEventsMoreThanOrEqualToDate(fromDate: Date, eventId: string) {
    const removedEvents = await this.eventRepetitionRepository.delete({
      eventId: eventId,
      startDateTime: MoreThanOrEqual(fromDate),
      // endDateTime: MoreThanOrEqual(toDate),
    });
    return removedEvents;
  }

  async removeEventsLessThanOrEqualToDate(fromDate: Date, eventId: string) {
    const removedEvents = await this.eventRepetitionRepository.delete({
      eventId: eventId,
      startDateTime: LessThanOrEqual(fromDate),
      // endDateTime: MoreThanOrEqual(toDate),
    });
    return removedEvents;
  }

  checkIfPatternIsSame(newRecurrencePattern, oldRecurrencePattern) {
    if (
      newRecurrencePattern.frequency === oldRecurrencePattern.frequency &&
      newRecurrencePattern.interval === oldRecurrencePattern.interval &&
      compareArrays(
        newRecurrencePattern.daysOfWeek,
        oldRecurrencePattern.daysOfWeek,
      )
    ) {
      return true;
    }
    return false;
  }

  checkIfDateIsSame(
    newRecurrenceStartDt: string,
    oldRecurrenceStartDt: string,
    newRecurrenceEndDt: string,
    oldRecurrenceEndDt: string,
  ) {
    const newStartRecDateTime = newRecurrenceStartDt.split('T');
    const oldStartRecDateTime = oldRecurrenceStartDt.split('T');
    const newEndRecDateTime = newRecurrenceEndDt.split('T');
    const oldEndRecDateTime = oldRecurrenceEndDt.split('T');

    const newRecStartDate = newStartRecDateTime[0];
    const oldRecStartDate = oldStartRecDateTime[0];
    const newRecEndDate = newEndRecDateTime[0];
    const oldRecEndDate = oldEndRecDateTime[0];
    const newRecStartTime = newStartRecDateTime[1];
    const oldRecStartTime = oldStartRecDateTime[1];
    const newRecEndTime = newEndRecDateTime[1];
    const oldRecEndTime = oldEndRecDateTime[1];

    if (
      newRecStartDate === oldRecStartDate &&
      newRecEndDate === oldRecEndDate
    ) {
      // start and end date same check if time is different
      if (
        newRecStartTime !== oldRecStartTime ||
        newRecEndTime !== oldRecEndTime
      ) {
        // time is different
        return {
          dateSame: true,
          timeSame: false,
        };
      } else {
        // date and time both same
        return {
          dateSame: true,
          timeSame: true,
        };
      }
    } else {
      // date is different
      return {
        dateSame: false,
        timeSame: false,
      };
    }
  }

  checkValidRecurrenceTimeForUpdate(endDate, recurrenceEndDate) {
    if (endDate.split('T')[1] !== recurrenceEndDate.split('T')[1]) {
      throw new BadRequestException(ERROR_MESSAGES.ENDTIME_DOES_NOT_MATCH);
    }
  }

  async getRecurrenceRecords(eventId, eventRepetitionStartDateTime) {
    return await this.eventRepetitionRepository
      .createQueryBuilder('eventRepetition')
      .innerJoinAndSelect('eventRepetition.eventDetail', 'eventDetail')
      .where('eventRepetition.eventId = :eventId', { eventId })
      .andWhere('eventRepetition.startDateTime >= :startDateTime', {
        startDateTime: eventRepetitionStartDateTime,
      })
      .andWhere('eventDetail.status != :status', { status: 'archived' })
      .orderBy('eventRepetition.startDateTime', 'ASC') // Sort by startDateTime in ascending order
      .getMany();
  }

  async getUpcomingRecurrenceRecords(
    eventId,
    eventDetailId,
    eventRepetitionStartDateTime,
  ) {
    return await this.eventRepetitionRepository
      .createQueryBuilder('eventRepetition')
      .innerJoinAndSelect('eventRepetition.eventDetail', 'eventDetail')
      .where('eventRepetition.eventId = :eventId', { eventId })
      .andWhere('eventRepetition.eventDetailId != :eventDetailId', {
        eventDetailId,
      })
      .andWhere('eventRepetition.startDateTime >= :startDateTime', {
        startDateTime: eventRepetitionStartDateTime,
      })
      .andWhere('eventDetail.status != :status', { status: 'archived' })
      .getMany();
  }

  async handleAllEventUpdate(
    updateBody: UpdateEventDto,
    event: Events,
    eventDetail: EventDetail,
    eventRepetition: EventRepetition,
  ) {
    updateBody.isRecurring = event.isRecurring;
    const { startDatetime, endDatetime } = updateBody;

    // new updated time from current update body
    eventRepetition['startDatetime'] = startDatetime;
    eventRepetition['endDatetime'] = endDatetime;

    const updateResult: UpdateResult = {};
    let updatedEvents;
    const eventAndEventDetails: {
      newEvent: Events;
      newEventDetail: EventDetail;
    } = { newEvent: event, newEventDetail: eventDetail };

    if (
      (!startDatetime || !endDatetime) &&
      updateBody.recurrencePattern &&
      event.isRecurring
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.PROVIDE_VALID_START_AND_END_DATETIME,
      );
    }

    // Handle recurring events
    if (startDatetime && endDatetime && event.isRecurring) {
      // Modify all recurring events that are not passed away
      // check if recurrence pattern is passed
      if (!updateBody.recurrencePattern) {
        throw new BadRequestException(
          ERROR_MESSAGES.RECURRENCE_PATTERN_MISSING,
        );
      }

      const startDateTime = startDatetime.split('T');
      const endDateTime = endDatetime.split('T');
      const startDate = startDateTime[0];
      const endDate = endDateTime[0];

      const startDateAndTimeOfCurrentEvent = eventRepetition.startDateTime
        .toISOString()
        .split('T');

      const startDateOfCurrentEvent = startDateAndTimeOfCurrentEvent[0];

      if (
        startDate !== startDateOfCurrentEvent ||
        endDate !== startDateOfCurrentEvent
      ) {
        throw new BadRequestException(
          'Invalid Date passed for this recurring event',
        );
      }

      if (event.recurrencePattern?.frequency && updateBody.recurrencePattern) {
        // undefined , past or equal to previously given date
        if (
          updateBody.recurrencePattern.recurringStartDate == undefined ||
          !new Date(updateBody.recurrencePattern.recurringStartDate)
        ) {
          throw new BadRequestException(
            'Please Provide Valid Recurring Start Date',
          );
        }

        new DateValidationPipe().transform(updateBody);
        new RecurringEndDateValidationPipe().transform(updateBody);

        updatedEvents = await this.updateRecurringEvents(
          updateBody.recurrencePattern,
          event.recurrencePattern,
          eventRepetition,
        );
      }
      if (updatedEvents) {
        if (
          !(updatedEvents.newEvent instanceof Events) &&
          updatedEvents.newEvent === event.eventId
        ) {
          eventAndEventDetails.newEvent = await this.findEventById(
            updatedEvents.newEvent,
          );
          eventAndEventDetails.newEventDetail = await this.getEventDetails(
            updatedEvents.newEventDetail,
          );
        }
        // else as passed from function
      } else {
        eventAndEventDetails.newEvent = event;
        eventAndEventDetails.newEventDetail = eventDetail;
      }
    } else if (startDatetime && endDatetime && !event.isRecurring) {
      // Modify self recurring Ignore rep pattern
      new DateValidationPipe().transform(updateBody);
      eventRepetition.startDateTime = new Date(updateBody.startDatetime);
      eventRepetition.endDateTime = new Date(updateBody.endDatetime);
      eventRepetition.updatedAt = new Date();
      await this.eventRepetitionRepository.save(eventRepetition);
      // ❌ REMOVED: updateResult.repetitionDetail = eventRepetition; (moved to end)
    }

    // get current first event as we regenerate new events and make other changes first event might change

    let firstEventDate =
      eventAndEventDetails.newEvent.recurrencePattern.recurringStartDate;

    if (!firstEventDate && !event.isRecurring) {
      firstEventDate = eventRepetition.startDateTime;
    }

    const currentFirstEvent = await this.getFirstEvent(
      eventAndEventDetails.newEvent.eventId,
      new Date(firstEventDate),
    );

    eventRepetition = currentFirstEvent;

    const recurrenceRecords = await this.getRecurrenceRecords(
      eventAndEventDetails.newEvent.eventId,
      eventRepetition.startDateTime,
    );

    const updateData: any = { updatedAt: new Date() };
    // Handle onlineDetails or erMetaData updates for single recurring event
    if (
      updateBody.onlineDetails ||
      updateBody.erMetaData ||
      updateBody.meetingType ||
      updateBody.approvalType ||
      updateBody.timezone
    ) {
      if (updateBody.onlineDetails) {
        Object.assign(eventRepetition.onlineDetails, updateBody.onlineDetails);
        updateData.onlineDetails = eventRepetition.onlineDetails;
        // ❌ REMOVED: updateResult.onlineDetails = updateBody.onlineDetails; (duplicate)
      }

      if (updateBody.erMetaData) {
        Object.assign(eventRepetition.erMetaData, updateBody.erMetaData);
        updateData.erMetaData = eventRepetition.erMetaData;
        updateResult.erMetaData = updateBody.erMetaData;
      }
    }

    // Handle new online meeting fields
    if (updateBody.meetingType) {
      eventRepetition.onlineDetails = eventRepetition.onlineDetails || {};
      (eventRepetition.onlineDetails as any).meetingType =
        updateBody.meetingType;
      updateData.onlineDetails = eventRepetition.onlineDetails;
      // ❌ REMOVED: updateResult.onlineDetails = { ...updateResult.onlineDetails, meetingType: updateBody.meetingType }; (duplicate)
    }

    if (updateBody.approvalType) {
      eventRepetition.onlineDetails = eventRepetition.onlineDetails || {};
      (eventRepetition.onlineDetails as any).approvalType =
        updateBody.approvalType;
      updateData.onlineDetails = eventRepetition.onlineDetails;
      // ❌ REMOVED: updateResult.onlineDetails = { ...updateResult.onlineDetails, approvalType: updateBody.approvalType }; (duplicate)
    }

    if (updateBody.timezone) {
      eventRepetition.onlineDetails = eventRepetition.onlineDetails || {};
      (eventRepetition.onlineDetails as any).timezone = updateBody.timezone;
      updateData.onlineDetails = eventRepetition.onlineDetails;
      // ❌ REMOVED: updateResult.onlineDetails = { ...updateResult.onlineDetails, timezone: updateBody.timezone }; (duplicate)
    }

    // NEW: Handle Zoom API integration based on platformIntegration parameter
    if (
      updateBody.platformIntegration !== false &&
      eventDetail.eventType === 'online'
    ) {
      // Get the Zoom meeting ID from existing eventRepetition data
      const existingMeetingId = (eventRepetition.onlineDetails as any)?.id;

      if (existingMeetingId) {
        try {
          // Calculate duration for logging and debugging
          let durationMinutes: number | undefined;
          if (updateBody.startDatetime && updateBody.endDatetime) {
            const startTime = new Date(updateBody.startDatetime);
            const endTime = new Date(updateBody.endDatetime);
            durationMinutes = Math.ceil(
              (endTime.getTime() - startTime.getTime()) / (1000 * 60),
            );
          }

          LoggerWinston.log(
            `Calling updateZoomMeeting for meeting ${existingMeetingId} with data: ${JSON.stringify(
              {
                title: updateBody.title,
                startDatetime: updateBody.startDatetime,
                endDatetime: updateBody.endDatetime,
                durationMinutes: durationMinutes,
                meetingType:
                  (eventRepetition.onlineDetails as any).meetingType ||
                  'meeting',
                platformIntegration: updateBody.platformIntegration,
              },
            )}`,
            API_ID.UPDATE_EVENT,
          );

          // Update Zoom meeting via API and get updated details
          const updatedZoomDetails = await this.updateZoomMeeting(
            existingMeetingId,
            updateBody,
            (eventRepetition.onlineDetails as any).meetingType || 'meeting',
            eventDetail.onlineProvider,
          );

          if (updatedZoomDetails) {
            const adapter = this.onlineMeetingAdapter.getAdapter();
            const meetingDetails = await adapter.getMeetingDetails(
              existingMeetingId,
              (eventRepetition.onlineDetails as any).meetingType || 'meeting',
            );

            this.logger.log(`Meeting details after update: ${meetingDetails}`);
            // Update local onlineDetails with actual Zoom data
            eventRepetition.onlineDetails = {
              ...eventRepetition.onlineDetails,
              id: meetingDetails.id,
              url: meetingDetails.join_url,
              start_url: meetingDetails.start_url,
              registration_url: meetingDetails.registration_url,
              password: meetingDetails.password,
              start_time: meetingDetails.start_time, // ✅ Add missing start_time
              duration: meetingDetails.duration, // ✅ Add missing duration
              providerGenerated: true, // Mark as provider-generated since it came from Zoom
              meetingType:
                updateBody.meetingType ||
                (eventRepetition.onlineDetails as any).meetingType,
              approvalType:
                updateBody.approvalType ||
                (eventRepetition.onlineDetails as any).approvalType,
              timezone:
                updateBody.timezone ||
                (eventRepetition.onlineDetails as any).timezone
            };

            this.logger.log(
              `EventRepetition onlineDetails after update: ${JSON.stringify(eventRepetition.onlineDetails)}`,
            );

            // ✅ SAVE THE UPDATED EVENTREPETITION TO DATABASE
            const savedEventRepetition =
              await this.eventRepetitionRepository.save(eventRepetition);

            // ✅ UPDATE THE EVENTREPETITION OBJECT WITH SAVED DATA
            eventRepetition = savedEventRepetition;

            // Update the updateData to include synced Zoom details
            updateData.onlineDetails = eventRepetition.onlineDetails;
            // ❌ REMOVED: updateResult.onlineDetails = eventRepetition.onlineDetails; (duplicate)
          } else {
            throw new BadRequestException(
              'Failed to update Zoom meeting via API',
            );
          }

          LoggerWinston.log(
            'Zoom meeting updated successfully via API',
            API_ID.UPDATE_EVENT,
          );
          (updateResult as any).zoomApiUpdated = true;
        } catch (error) {
          LoggerWinston.error(
            'Failed to update Zoom meeting via API',
            API_ID.UPDATE_EVENT,
            error,
          );
          (updateResult as any).zoomApiError = error.message;
          // Continue with local update even if Zoom API fails
        }
      } else {
        LoggerWinston.warn(
          `No Zoom meeting ID found in eventRepetition.onlineDetails. Cannot update Zoom meeting.`,
          API_ID.UPDATE_EVENT,
        );
        (updateResult as any).zoomApiError = 'No Zoom meeting ID found';
      }

      updateResult.updatedRecurringEvent = await this.updateEventRepetition(
        recurrenceRecords,
        updateData,
      );

      // ✅ SET THE UPDATED EVENTREPETITION AFTER ALL CHANGES
      updateResult.repetitionDetail = eventRepetition;
    }

    // Handle event detail updates
    if (
      updateBody.title ||
      updateBody.location ||
      updateBody.latitude ||
      updateBody.status ||
      updateBody.onlineDetails ||
      updateBody.metadata
    ) {
      updateResult.updatedEventDetails =
        await this.updateEventDetailsForRecurringEvents(
          updateBody,
          recurrenceRecords,
          eventAndEventDetails.newEvent,
          eventAndEventDetails.newEventDetail,
          eventRepetition,
        );
    }
    return { ...updateResult, event: eventAndEventDetails.newEvent };
  }

  async updateEventDetailsForRecurringEvents(
    updateBody,
    recurrenceRecords: EventRepetition[],
    event: Events,
    eventDetail: EventDetail,
    eventRepetition,
  ) {
    const updateResult = {};

    // Get event which eventDetailId is diffrent from main eventDetailId from eventRepetation table[use for delete]
    const upcomingrecurrenceRecords = await this.getUpcomingRecurrenceRecords(
      event.eventId,
      eventDetail.eventDetailId,
      eventRepetition.startDateTime,
    );
    const existingEventDetails = eventDetail;

    // onlineDetails updates are now handled in EventRepetition, not EventDetail
    if (updateBody.metadata) {
      Object.assign(existingEventDetails.metadata, updateBody.metadata);
    }

    // get first event
    const firstEvent: EventRepetition = recurrenceRecords[0];

    if (firstEvent.eventRepetitionId === eventRepetition.eventRepetitionId) {
      // Always true in case of non recurring
      Object.assign(existingEventDetails, updateBody, {
        eventRepetitionId: eventRepetition.eventRepetitionId,
      });
      existingEventDetails.updatedAt = new Date();
      const updatedEventDetails =
        await this.eventDetailRepository.save(existingEventDetails);
      // below code run for update of recurring event
      if (recurrenceRecords.length > 0) {
        const updatedEventRepetition = await this.updateEventRepetition(
          recurrenceRecords,
          {
            eventDetailId: event.eventDetailId,
          },
        );
        updateResult['updatedEvents'] = updatedEventRepetition.affected;
      }
      // delete eventDetail from eventDetail table if futher created single-single for upcoming session
      if (upcomingrecurrenceRecords.length > 0) {
        await this.deleteEventDetail(
          upcomingrecurrenceRecords.map((record) => record.eventDetailId),
        );
      }
      updateResult['eventDetails'] = updatedEventDetails;
    } else {
      // Not going in this condition if event is non recurring
      // create new entry for new updated record which connect all upcoming and this event
      if (eventRepetition.eventDetailId === event.eventDetailId) {
        Object.assign(existingEventDetails, updateBody);
        existingEventDetails.eventDetailId = undefined;
        const saveNewEntry =
          await this.eventDetailRepository.save(existingEventDetails);

        // update eventDetail id in all places which are greater than and equal to curreitn repetation startDate in repetation table
        if (recurrenceRecords.length > 0) {
          const updatedEventRepetition = await this.updateEventRepetition(
            recurrenceRecords,
            {
              eventDetailId: saveNewEntry.eventDetailId,
            },
          );
          updateResult['updatedEvents'] = updatedEventRepetition.affected;
        }
        // delete eventDetail from eventDetail table if futher created single-single for upcoming session
        if (upcomingrecurrenceRecords.length > 0) {
          await this.deleteEventDetail(
            upcomingrecurrenceRecords.map((record) => record.eventDetailId),
          );
        }
        updateResult['eventDetails'] = saveNewEntry;
      } else {
        // do change in existing eventDetail row [eventRepetition.eventDetails me] table
        const repetationeventDetailexistingResult = await this.getEventDetails(
          eventRepetition.eventDetailId,
        );

        let neweventDetailsId;
        const numberOfEntryInEventRepetitionTable =
          await this.getEventRepetitionOccurrences(
            eventRepetition.eventDetailId,
          );

        // onlineDetails updates are now handled in EventRepetition, not EventDetail
        if (numberOfEntryInEventRepetitionTable.length === 1) {
          Object.assign(repetationeventDetailexistingResult, updateBody, {
            eventRepetitionId: eventRepetition.eventRepetitionId,
          });

          const result = await this.eventDetailRepository.save(
            repetationeventDetailexistingResult,
          );
          neweventDetailsId = result.eventDetailId;
          updateResult['eventDetails'] = result;
        } else {
          // if greater than then create new entry in eventDetail Table
          Object.assign(repetationeventDetailexistingResult, updateBody, {
            eventRepetitionId: eventRepetition.eventRepetitionId,
          });
          repetationeventDetailexistingResult.eventDetailId = undefined;
          const result = await this.eventDetailRepository.save(
            repetationeventDetailexistingResult,
          );
          neweventDetailsId = result.eventDetailId;
          updateResult['eventDetails'] = result;
        }
      }
    }

    return updateResult;
  }

  async handleSpecificRecurrenceUpdate(updateBody, event, eventRepetition) {
    const updateResult: UpdateResult = {};
    if (updateBody?.startDatetime && updateBody?.endDatetime) {
      new DateValidationPipe().transform(updateBody);
      eventRepetition.startDateTime = updateBody.startDatetime;
      eventRepetition.endDateTime = updateBody.endDatetime;
      eventRepetition.updatedAt = new Date();
      await this.eventRepetitionRepository.save(eventRepetition);
      updateResult.repetitionDetail = eventRepetition;
    }
    const existingEventDetails = await this.getEventDetails(
      eventRepetition.eventDetailId,
    );

    existingEventDetails.updatedAt = new Date();

    if (
      updateBody.title ||
      updateBody.location ||
      updateBody.latitude ||
      updateBody.status ||
      updateBody.onlineDetails ||
      updateBody.metadata
    ) {
      // onlineDetails updates are now handled in EventRepetition, not EventDetail
      // Only handle metadata updates in EventDetail

      if (event.eventDetailId === existingEventDetails.eventDetailId) {
        // as we are updating event from set of events we will make its details separate
        Object.assign(existingEventDetails, updateBody, {
          eventRepetitionId: eventRepetition.eventRepetitionId,
        });
        existingEventDetails.updatedAt = new Date();
        const result =
          await this.eventDetailRepository.save(existingEventDetails);
        // result contains separated event details which are new and then assign it to the repetition event
        eventRepetition.eventDetailId = result.eventDetailId;
        eventRepetition.updatedAt = new Date();
        await this.eventRepetitionRepository.save(eventRepetition);
        updateResult.eventDetails = result;
      } else {
        // check in event repetition table where existingEventDetails.eventDetailId against how many record exist
        const numberOfEntryInEventRepetitionTable =
          await this.getEventRepetitionOccurrences(
            existingEventDetails.eventDetailId,
          );

        if (numberOfEntryInEventRepetitionTable.length === 1) {
          Object.assign(existingEventDetails, updateBody, {
            eventRepetitionId: eventRepetition.eventRepetitionId,
          });
          const result =
            await this.eventDetailRepository.save(existingEventDetails);
          updateResult.eventDetails = result;
        } else {
          // if greater than then create new entry in eventDetail Table
          Object.assign(existingEventDetails, updateBody, {
            eventRepetitionId: eventRepetition.eventRepetitionId,
          });
          existingEventDetails.eventDetailId = undefined;
          const result =
            await this.eventDetailRepository.save(existingEventDetails);
          eventRepetition.eventDetailId = result.eventDetailId;
          eventRepetition.updatedAt = new Date();
          await this.eventRepetitionRepository.save(eventRepetition);
          updateResult.eventDetails = result;
        }
      }
    }
    if (
      updateBody.onlineDetails ||
      updateBody.erMetaData ||
      updateBody.meetingType ||
      updateBody.approvalType ||
      updateBody.timezone
    ) {
      if (updateBody.onlineDetails) {
        Object.assign(eventRepetition.onlineDetails, updateBody.onlineDetails);
      }
      if (updateBody.erMetaData) {
        Object.assign(eventRepetition.erMetaData, updateBody.erMetaData);
      }

      // Handle new online meeting fields
      if (updateBody.meetingType) {
        eventRepetition.onlineDetails = eventRepetition.onlineDetails || {};
        (eventRepetition.onlineDetails as any).meetingType =
          updateBody.meetingType;
      }

      if (updateBody.approvalType) {
        eventRepetition.onlineDetails = eventRepetition.onlineDetails || {};
        (eventRepetition.onlineDetails as any).approvalType =
          updateBody.approvalType;
      }

      if (updateBody.timezone) {
        eventRepetition.onlineDetails = eventRepetition.onlineDetails || {};
        (eventRepetition.onlineDetails as any).timezone = updateBody.timezone;
      }

      // NEW: Handle Zoom API integration based on platformIntegration parameter
      if (
        updateBody.platformIntegration !== false &&
        eventRepetition.onlineDetails
      ) {
        // Get the Zoom meeting ID from existing eventRepetition data
        const existingMeetingId = (eventRepetition.onlineDetails as any)?.id;

        if (existingMeetingId) {
          try {
            const eventDetail = await this.getEventDetails(
              eventRepetition.eventDetailId,
            );

            // Calculate duration for logging and debugging
            let durationMinutes: number | undefined;
            if (updateBody.startDatetime && updateBody.endDatetime) {
              const startTime = new Date(updateBody.startDatetime);
              const endTime = new Date(updateBody.endDatetime);
              durationMinutes = Math.ceil(
                (endTime.getTime() - startTime.getTime()) / (1000 * 60),
              );
            }

            LoggerWinston.log(
              `Calling updateZoomMeeting for meeting ${existingMeetingId} with data: ${JSON.stringify(
                {
                  title: updateBody.title,
                  startDatetime: updateBody.startDatetime,
                  endDatetime: updateBody.endDatetime,
                  durationMinutes: durationMinutes,
                  meetingType:
                    (eventRepetition.onlineDetails as any).meetingType ||
                    'meeting',
                  platformIntegration: updateBody.platformIntegration,
                },
              )}`,
              API_ID.UPDATE_EVENT,
            );

            // Update Zoom meeting via API and get updated details
            const updatedZoomDetails = await this.updateZoomMeeting(
              existingMeetingId,
              updateBody,
              (eventRepetition.onlineDetails as any).meetingType || 'meeting',
              eventDetail.onlineProvider,
            );

            // Sync the updated Zoom data back to local database
            if (updatedZoomDetails) {
              // Update local onlineDetails with actual Zoom data
              eventRepetition.onlineDetails = {
                ...eventRepetition.onlineDetails,
                id: updatedZoomDetails.id || existingMeetingId,
                url:
                  updatedZoomDetails.join_url ||
                  updatedZoomDetails.url ||
                  (eventRepetition.onlineDetails as any).url,
                start_url:
                  updatedZoomDetails.start_url ||
                  (eventRepetition.onlineDetails as any).start_url,
                registration_url:
                  updatedZoomDetails.registration_url ||
                  (eventRepetition.onlineDetails as any).registration_url,
                password:
                  updatedZoomDetails.password ||
                  (eventRepetition.onlineDetails as any).password,
                start_time: updatedZoomDetails.start_time, // ✅ Add missing start_time
                duration: updatedZoomDetails.duration, // ✅ Add missing duration
                providerGenerated: true, // Mark as provider-generated since it came from Zoom
                meetingType:
                  updateBody.meetingType ||
                  (eventRepetition.onlineDetails as any).meetingType,
                approvalType:
                  updateBody.approvalType ||
                  (eventRepetition.onlineDetails as any).approvalType,
                timezone:
                  updateBody.timezone ||
                  (eventRepetition.onlineDetails as any).timezone
              };
            }

            LoggerWinston.log(
              'Zoom meeting updated successfully via API',
              API_ID.UPDATE_EVENT,
            );
            (updateResult as any).zoomApiUpdated = true;
          } catch (error) {
            LoggerWinston.error(
              'Failed to update Zoom meeting via API',
              API_ID.UPDATE_EVENT,
              error,
            );
            (updateResult as any).zoomApiError = error.message;
            // Continue with local update even if Zoom API fails
          }
        } else {
          LoggerWinston.warn(
            `No Zoom meeting ID found in eventRepetition.onlineDetails. Cannot update Zoom meeting.`,
            API_ID.UPDATE_EVENT,
          );
          (updateResult as any).zoomApiError = 'No Zoom meeting ID found';
        }
      }

      eventRepetition.updatedAt = new Date();
      const savedEventRepetition =
        await this.eventRepetitionRepository.save(eventRepetition);

      // ✅ UPDATE THE EVENTREPETITION OBJECT WITH SAVED DATA
      eventRepetition = savedEventRepetition;
    }
    return updateResult;
  }

  isInvalidUpdate(updateBody: UpdateEventDto, eventDetail: EventDetail) {
    if (updateBody['eventType']) {
      return {
        isValid: false,
        message: ERROR_MESSAGES.EVENT_TYPE_CHANGE_NOT_SUPPORTED,
      };
    }

    if (updateBody.location || (updateBody.latitude && updateBody.longitude)) {
      if (eventDetail.eventType === 'online') {
        return {
          isValid: false,
          message:
            ERROR_MESSAGES.CANNOT_UPDATE_LOCATION_DETAILS_FOR_ONLINE_EVENT,
        };
      }
    }

    if (
      updateBody.onlineDetails ||
      updateBody.meetingType ||
      updateBody.approvalType ||
      updateBody.timezone
    ) {
      if (eventDetail.eventType === 'offline') {
        return {
          isValid: false,
          message:
            ERROR_MESSAGES.CANNOT_UPDATE_ONLINE_DETAILS_FOR_OFFLINE_EVENT,
        };
      }
    }

    return { isValid: true };
  }

  async createEventDetailDB(
    createEventDto: CreateEventDto,
  ): Promise<EventDetail> {
    const eventDetail = new EventDetail();
    eventDetail.title = createEventDto.title;
    eventDetail.shortDescription = createEventDto.shortDescription;
    eventDetail.description = createEventDto.description;
    eventDetail.eventType = createEventDto.eventType;
    eventDetail.isRestricted = createEventDto.isRestricted;
    eventDetail.location = createEventDto.location;
    eventDetail.longitude = createEventDto.longitude;
    eventDetail.latitude = createEventDto.latitude;
    eventDetail.onlineProvider = createEventDto.onlineProvider;
    eventDetail.maxAttendees = createEventDto?.maxAttendees;
    eventDetail.recordings = createEventDto?.recordings;
    eventDetail.status = createEventDto.status;
    eventDetail.meetingDetails = createEventDto.meetingDetails,
    eventDetail.attendees = createEventDto?.attendees?.length
      ? createEventDto.attendees
      : null;
    // Remove onlineDetails assignment - it will be stored in EventRepetition
    eventDetail.idealTime = createEventDto?.idealTime
      ? createEventDto.idealTime
      : null;
    eventDetail.metadata = createEventDto?.metaData ?? {};
    eventDetail.createdBy = createEventDto.createdBy;
    eventDetail.updatedBy = createEventDto.updatedBy;
    eventDetail.createdAt = new Date();
    eventDetail.updatedAt = new Date();

    return this.eventDetailRepository.save(eventDetail);
  }

  async createEventDB(
    createEventDto: CreateEventDto,
    eventDetail: EventDetail,
  ) {
    const {
      isRecurring,
      recurrencePattern,
      registrationStartDate,
      registrationEndDate,
    } = createEventDto;
    const event = new Events();

    if (
      recurrencePattern?.endCondition?.value &&
      recurrencePattern.frequency === Frequency.weekly
    ) {
      recurrencePattern.recurringStartDate = createEventDto.startDatetime;
      recurrencePattern.daysOfWeek?.sort((a, b) => a - b);
    }
    event.isRecurring = isRecurring;
    // event.recurrenceEndDate = recurrenceEndDate
    //   ? new Date(recurrenceEndDate)
    //   : null;
    event.recurrencePattern = recurrencePattern ?? {};
    event.createdAt = new Date();
    event.updatedAt = new Date();
    event.autoEnroll = createEventDto.autoEnroll;
    event.registrationStartDate = registrationStartDate
      ? new Date(registrationStartDate)
      : null;
    event.registrationEndDate = registrationEndDate
      ? new Date(registrationEndDate)
      : null;
    event.createdBy = createEventDto.createdBy;
    event.updatedBy = createEventDto.updatedBy;
    event.eventDetail = eventDetail;

    return this.eventRepository.save(event);
  }

  async createEventRepetitionDB(
    createEventDto: CreateEventDto,
    event: Events,
    eventDetail: EventDetail,
  ) {
    const eventRepetition = new EventRepetition();
    eventRepetition.event = event;
    eventRepetition.eventDetail = eventDetail;
    eventRepetition.onlineDetails = createEventDto.meetingDetails;

    if (
      createEventDto.eventType === EventTypes.online &&
      createEventDto.isMeetingNew === false
    ) {
      eventRepetition.onlineDetails['occurrenceId'] = '';
      eventRepetition.onlineDetails['attendanceMarked'] = false;
    }
    eventRepetition.startDateTime = new Date(createEventDto.startDatetime);
    eventRepetition.endDateTime = new Date(createEventDto.endDatetime);
    eventRepetition.createdBy = createEventDto.createdBy;
    eventRepetition.updatedBy = createEventDto.updatedBy;
    eventRepetition.erMetaData = createEventDto.erMetaData ?? {};
    eventRepetition.createdAt = new Date();
    eventRepetition.updatedAt = new Date();
    return this.eventRepetitionRepository.save(eventRepetition);
  }

  createRepetitionOccurrence(
    createEventDto: CreateEventDto,
    eventDetailId: string,
    eventId: string,
    isEdit: boolean,
  ): EventRepetition {
    const eventRepetition = new EventRepetition();
    eventRepetition.eventDetailId = eventDetailId;
    eventRepetition.eventId = eventId;
    if (isEdit && createEventDto instanceof EventRepetition) {
      eventRepetition.createdBy = createEventDto.createdBy;
      eventRepetition.onlineDetails = createEventDto.onlineDetails;
      eventRepetition.erMetaData = createEventDto.erMetaData;
    } else {
      eventRepetition.onlineDetails = createEventDto.meetingDetails;
      eventRepetition.erMetaData = createEventDto.erMetaData ?? {};
    }
    if (
      createEventDto.eventType === EventTypes.online &&
      createEventDto.isMeetingNew === false
    ) {
      eventRepetition.onlineDetails['occurrenceId'] = '';
      eventRepetition.onlineDetails['attendanceMarked'] = false;
    }
    eventRepetition.startDateTime = null;
    eventRepetition.endDateTime = null;
    eventRepetition.createdBy = createEventDto.createdBy;
    eventRepetition.updatedBy = createEventDto.updatedBy;
    eventRepetition.createdAt = new Date();
    eventRepetition.updatedAt = new Date();

    return eventRepetition;
  }

  async createOfflineOrOnlineEvent(createEventDto: CreateEventDto) {
    // recurring & non-recurring

    if (createEventDto.eventType === EventTypes.offline) {
      // create offline event
      createEventDto.onlineProvider = null;
      createEventDto.meetingDetails = null;
      createEventDto.recordings = null;
    } else if (createEventDto.eventType === EventTypes.online) {
      if (createEventDto.platformIntegration === false) {
        // Use existing meeting details
        createEventDto.meetingDetails.providerGenerated = false;
        createEventDto.meetingDetails.meetingType =
          createEventDto.meetingType || MeetingType.meeting;
      } else {
        // Create new meeting automatically
        createEventDto = await this.createNewMeeting(createEventDto);
      }
    }

    const createdEventDetailDB = await this.createEventDetailDB(createEventDto);

    const createdEventDB = await this.createEventDB(
      createEventDto,
      createdEventDetailDB,
    );

    let erep: EventRepetition | InsertResult;

    if (createEventDto.isRecurring) {
      erep = await this.createRecurringEvents(
        createEventDto,
        createdEventDB.eventId,
        createdEventDetailDB.eventDetailId,
      );
      return {
        res: this.generateEventResponse(
          createdEventDB,
          erep?.generatedMaps[0],
          erep?.generatedMaps.length,
        ),
        eventRepetitionIds: erep.identifiers,
      };
    } else {
      // createNonRecurringEvent
      erep = await this.createEventRepetitionDB(
        createEventDto,
        createdEventDB,
        createdEventDetailDB,
      );
      const { event, eventDetail, ...repetitionDtl } = erep;

      return {
        res: this.generateEventResponse(event, repetitionDtl),
        eventRepetitionIds: [{ eventRepetitionId: erep.eventRepetitionId }],
      };
    }

    // generate and return response body
  }

  async createRecurringEvents(
    createEventDto: CreateEventDto,
    eventId: string,
    eventDetailId: string,
    isEdit: boolean = false,
  ) {
    if (!(this.eventCreationLimit > 0)) {
      await this.removePartiallyCreatedData(eventId, eventDetailId);
      throw new BadRequestException(ERROR_MESSAGES.CREATION_LIMIT_UNAVAILABLE);
    }

    const eventOccurrences = this.generateEventOccurrences(
      createEventDto,
      eventDetailId,
      eventId,
      isEdit,
    );

    if (eventOccurrences.length > this.eventCreationLimit) {
      await this.removePartiallyCreatedData(eventId, eventDetailId);
      throw new BadRequestException(ERROR_MESSAGES.CREATION_COUNT_EXCEEDED);
    } else if (eventOccurrences.length <= 0) {
      await this.removePartiallyCreatedData(eventId, eventDetailId);
      throw new BadRequestException(
        ERROR_MESSAGES.RECURRENCE_PERIOD_INSUFFICIENT,
      );
    } else {
      const insertedOccurrences = await this.eventRepetitionRepository
        .createQueryBuilder()
        .insert()
        .into('EventRepetition')
        .values(eventOccurrences)
        .returning(['onlineDetails', 'erMetaData'])
        .execute();

      return insertedOccurrences;
    }
  }

  generateEventResponse(
    event: Events,
    repetitionDtl: Partial<RepetitionDetail>,
    createdEventCount: number = 1,
  ) {
    const { eventDetail, ...other } = event;

    delete eventDetail.attendees;
    const repetitionDetail = {};
    repetitionDetail['eventRepetitionId'] = repetitionDtl.eventRepetitionId;
    repetitionDetail['startDateTime'] = repetitionDtl.startDateTime;
    repetitionDetail['endDateTime'] = repetitionDtl.endDateTime;
    repetitionDetail['onlineDetails'] = repetitionDtl.onlineDetails;
    repetitionDetail['erMetaData'] = repetitionDtl.erMetaData;

    const response = Object.assign(eventDetail, other, repetitionDetail, {
      createdEventCount,
    });

    return response;
  }

  async getEventRepetitionOccurrences(
    eventDetailId: string,
  ): Promise<EventRepetition[]> {
    return this.eventRepetitionRepository.find({ where: { eventDetailId } });
  }

  async getEventDetails(eventDetailId: string): Promise<EventDetail> {
    return this.eventDetailRepository.findOne({ where: { eventDetailId } });
  }

  async findEventById(eventId: string): Promise<Events> {
    return this.eventRepository.findOne({ where: { eventId } });
  }

  async getFirstEvent(
    eventId: string,
    eventRepetitionStartDateTime: Date,
  ): Promise<EventRepetition> {
    return await this.eventRepetitionRepository.findOne({
      where: {
        eventId,
        startDateTime: MoreThanOrEqual(eventRepetitionStartDateTime),
        eventDetail: {
          status: Not('archived'),
        },
      },
      relations: ['eventDetail'], // To replace `innerJoinAndSelect`
      order: {
        startDateTime: 'ASC', // Sort by startDateTime in ascending order
      },
    });
  }

  generateEventOccurrences(
    createEventDto: CreateEventDto,
    eventDetailId: string,
    eventId: string,
    isEdit: boolean = false,
  ) {
    const config = createEventDto.recurrencePattern;
    const startDate = createEventDto.startDatetime;
    const endDate = createEventDto.endDatetime;
    const occurrences: EventRepetition[] = [];

    // if we convert to local time and then generate occurrences
    const currentDateUTC = new Date(startDate);

    let currentDate = new Date(
      currentDateUTC.toLocaleString('en-US', { timeZone: this.timezone }),
    ); // Convert to given timezone

    const currentEnd = new Date(endDate);

    const endDateTimeZoned = new Date(
      currentEnd.toLocaleString('en-US', { timeZone: this.timezone }),
    );

    const endTime = endDateTimeZoned.toISOString().split('T')[1];
    let createFirst = true;

    const getEndDate = (currentDate: Date): string => {
      const endDate = currentDate.toISOString().split('T')[0] + 'T' + endTime;
      return endDate;
    };

    const removeZChar = (date: string): string => {
      return date.slice(0, -1);
    };

    const convertToUTC = (istTime: string): string => {
      // Convert the IST time string to UTC using moment-timezone
      const utcTime = moment.tz(istTime, this.timezone).utc().toISOString();
      return utcTime;
    };

    const addDays = (date: Date, days: number): Date => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };

    const getNextValidDay = (
      currentDay: number,
      daysOfWeek: DaysOfWeek[],
    ): number => {
      for (const day of daysOfWeek) {
        if (day > currentDay) {
          return day - currentDay;
        }
      }
      return 7 - currentDay + daysOfWeek[0]; // Move to the next valid week
    };

    const endConditionMet = (
      endCondition: RecurrencePattern['endCondition'],
      occurrences1: EventRepetition[],
    ) => {
      if (endCondition.type === 'endDate') {
        return (
          occurrences1[occurrences1.length - 1]?.endDateTime >
          new Date(endCondition.value)
        );
      } else if (endCondition.type === EndConditionType.occurrences) {
        return occurrences1.length >= parseInt(endCondition.value);
      }
      return false;
    };

    while (!endConditionMet(config.endCondition, occurrences)) {
      const eventRec = this.createRepetitionOccurrence(
        createEventDto,
        eventDetailId,
        eventId,
        isEdit,
      );

      const currentDay = currentDate.getDay();

      // Check if the current day is a valid day in the recurrence pattern
      if (
        config.frequency === 'weekly' &&
        config.daysOfWeek.includes(currentDay) &&
        createFirst
      ) {
        const eventRec = this.createRepetitionOccurrence(
          createEventDto,
          eventDetailId,
          eventId,
          isEdit,
        );
        const endDtm = getEndDate(currentDate);

        eventRec.startDateTime = new Date(
          convertToUTC(removeZChar(currentDate.toISOString())),
        );
        eventRec.endDateTime = new Date(convertToUTC(removeZChar(endDtm)));

        occurrences.push(eventRec);
      }

      if (config.frequency === Frequency.daily) {
        const endDtm = getEndDate(currentDate);

        eventRec.startDateTime = new Date(
          convertToUTC(removeZChar(currentDate.toISOString())),
        );
        eventRec.endDateTime = new Date(convertToUTC(removeZChar(endDtm)));

        occurrences.push(eventRec);
        currentDate = addDays(currentDate, config.interval);
      } else if (config.frequency === Frequency.weekly) {
        createFirst = false;
        const currentDay = currentDate.getDay();
        const daysUntilNextOccurrence = getNextValidDay(
          currentDay,
          config.daysOfWeek,
        );
        currentDate = addDays(currentDate, daysUntilNextOccurrence);
        const endDtm = getEndDate(currentDate);

        eventRec.startDateTime = new Date(
          convertToUTC(removeZChar(currentDate.toISOString())),
        );
        eventRec.endDateTime = new Date(convertToUTC(removeZChar(endDtm)));

        occurrences.push(eventRec);
        if (
          currentDate.getDay() ===
          config.daysOfWeek[config.daysOfWeek.length - 1]
        ) {
          currentDate = addDays(currentDate, 7 * (config.interval - 1)); // Skip weeks based on interval
        }
      }
    }

    // Remove the last occurrence if it exceeds the end date condition
    if (
      config.endCondition.type === 'endDate' &&
      occurrences[occurrences.length - 1]?.endDateTime >
        new Date(config.endCondition.value)
    ) {
      occurrences.pop();
    }

    return occurrences;
  }

  private async createNewMeeting(
    createEventDto: CreateEventDto,
  ): Promise<CreateEventDto> {
    try {
      const adapter = this.onlineMeetingAdapter.getAdapter();
      const meetingType = createEventDto.meetingType || MeetingType.meeting;
      const startTime = new Date(createEventDto.startDatetime);
      const endTime = new Date(createEventDto.endDatetime);
      const durationMinutes = Math.ceil(
        (endTime.getTime() - startTime.getTime()) / (1000 * 60),
      );

      const meetingRequest: CreateMeetingRequest = {
        topic: createEventDto.title,
        startTime: createEventDto.startDatetime,
        duration: durationMinutes,
        timezone: createEventDto.timezone || 'UTC',
        approvalType: createEventDto.approvalType || ApprovalType.AUTOMATIC,
        settings: {
          hostVideo: true,
          participantVideo: true,
          joinBeforeHost: true,
          muteUponEntry: true,
          watermark: false,
          usePmi: false,
          audio: 'both',
          autoRecording: 'none',
          registrantsConfirmationEmail: true,
          registrantsEmailNotification: true,
          waitingRoom: false,
          jbhTime: 0,
        },
      };

      const meetingResponse = await adapter.createMeeting(
        meetingRequest,
        meetingType,
      );

      createEventDto.meetingDetails = {
        id: meetingResponse.id,
        url: meetingResponse.join_url,
        start_url: meetingResponse.start_url,
        registration_url: meetingResponse.registration_url,
        password: meetingResponse.password,
        providerGenerated: true,
        occurrenceId: '',
        attendanceMarked: false,
        meetingType: meetingType,
        approvalType: meetingRequest.approvalType,
        timezone: createEventDto.timezone || 'UTC'
      };

      LoggerWinston.log(
        `Successfully created new ${meetingType} with ID: ${meetingResponse.id}`,
        API_ID.CREATE_EVENT,
        createEventDto.createdBy,
      );

      return createEventDto;
    } catch (error) {
      LoggerWinston.error(
        `Failed to create new meeting: ${error.message}`,
        API_ID.CREATE_EVENT,
        createEventDto.createdBy,
      );
      throw error;
    }
  }

  private validateTimezone() {
    if (!this.timezone?.trim()?.length) {
      throw new BadRequestException(ERROR_MESSAGES.TIMEZONE_NOT_PROVIDED);
    }
  }

  async deleteEvent(eventId: string): Promise<DeleteResult> {
    return this.eventRepository.delete({ eventId });
  }

  async deleteEventDetail(eventDetailIds: string[]): Promise<DeleteResult> {
    return this.eventDetailRepository.delete({
      eventDetailId: In(eventDetailIds),
    });
  }

  async removePartiallyCreatedData(
    eventId: string,
    eventDetailId: string,
  ): Promise<PromiseSettledResult<undefined | DeleteResult>[]> {
    const promises = [
      this.deleteEvent(eventId),
      this.deleteEventDetail([eventDetailId]),
    ];

    const responses = await Promise.allSettled(promises);
    return responses;
  }

  async updateZoomMeeting(
    meetingId: string,
    updateBody: UpdateEventDto,
    meetingType: MeetingType,
    onlineProvider: string,
  ): Promise<any> {
    try {
      const adapter = this.onlineMeetingAdapter.getAdapter();

      // Only calculate duration if both start and end times are provided
      let durationMinutes: number | undefined;
      if (updateBody.startDatetime && updateBody.endDatetime) {
        const startTime = new Date(updateBody.startDatetime);
        const endTime = new Date(updateBody.endDatetime);
        durationMinutes = Math.ceil(
          (endTime.getTime() - startTime.getTime()) / (1000 * 60),
        );
      }

      const meetingRequest: CreateMeetingRequest = {
        topic: updateBody.title,
        startTime: updateBody.startDatetime,
        duration: durationMinutes,
        timezone: updateBody.timezone || 'UTC',
        approvalType: updateBody.approvalType || ApprovalType.AUTOMATIC,
        settings: {
          hostVideo: true,
          participantVideo: true,
          joinBeforeHost: true,
          muteUponEntry: true,
          watermark: false,
          usePmi: false,
          audio: 'both',
          autoRecording: 'none',
          registrantsConfirmationEmail: true,
          registrantsEmailNotification: true,
          waitingRoom: false,
          jbhTime: 0,
        },
      };

      // Update the meeting via Zoom API and get response
      const updateResponse = await adapter.updateMeeting(
        meetingId,
        meetingRequest,
        meetingType,
      );

      LoggerWinston.log(
        `Successfully updated Zoom meeting with ID: ${meetingId}. Updated fields: ${JSON.stringify(
          {
            title: updateBody.title,
            startDatetime: updateBody.startDatetime,
            endDatetime: updateBody.endDatetime,
            duration: durationMinutes,
            timezone: updateBody.timezone,
            approvalType: updateBody.approvalType,
          },
        )}`,
        API_ID.UPDATE_EVENT,
      );

      // Return the update response for local sync
      return updateResponse;
    } catch (error) {
      LoggerWinston.error(
        `Failed to update Zoom meeting: ${error.message}`,
        API_ID.UPDATE_EVENT,
      );
      throw error;
    }
  }

  /**
   * Get event by eventId along with all its repetition events
   */
  async getEventById(eventId: string, response: Response): Promise<Response> {
    const apiId = API_ID.GET_EVENT_BY_ID;
    this.validateTimezone();

    // Find the main event with all its repetitions in a single query
    const event = await this.eventRepository.findOne({
      where: { eventId },
      relations: ['eventDetail', 'eventRepetitions'],
    });

    if (!event) {
      throw new NotFoundException(ERROR_MESSAGES.EVENT_NOT_FOUND);
    }

    if (!event.eventRepetitions || event.eventRepetitions.length === 0) {
      throw new NotFoundException(ERROR_MESSAGES.EVENT_NOT_FOUND);
    }

    // Add isEnded flag to each repetition
    const today = new Date();
    const repetitionsWithStatus = event.eventRepetitions.map((repetition) => {
      const endDateTime = new Date(repetition.endDateTime);
      return {
        ...repetition,
        isEnded: endDateTime < today,
      };
    });

    const result = {
      event: {
        eventId: event.eventId,
        isRecurring: event.isRecurring,
        recurrencePattern: event.recurrencePattern,
        autoEnroll: event.autoEnroll,
        registrationStartDate: event.registrationStartDate,
        registrationEndDate: event.registrationEndDate,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        createdBy: event.createdBy,
        updatedBy: event.updatedBy,
        eventDetail: event.eventDetail,
      },
      repetitions: repetitionsWithStatus,
      totalRepetitions: repetitionsWithStatus.length,
    };

    LoggerWinston.log(
      `Event fetched successfully with ${repetitionsWithStatus.length} repetitions`,
      apiId,
    );

    return response
      .status(HttpStatus.OK)
      .json(APIResponse.success(apiId, result, 'Event fetched successfully'));
  }

  /**
   * Get event by repetitionId
   */
  async getEventByRepetitionId(
    repetitionId: string,
    response: Response,
  ): Promise<Response> {
    const apiId = API_ID.GET_EVENT_BY_REPETITION_ID;
    this.validateTimezone();

    // Find the event repetition with its related data
    const eventRepetition = await this.eventRepetitionRepository.findOne({
      where: { eventRepetitionId: repetitionId },
      relations: ['eventDetail'],
    });

    if (!eventRepetition) {
      throw new NotFoundException(ERROR_MESSAGES.EVENT_NOT_FOUND);
    }

    // Add isEnded flag
    const today = new Date();
    const endDateTime = new Date(eventRepetition.endDateTime);
    const isEnded = endDateTime < today;

    const result = {
      eventRepetition: {
        ...eventRepetition,
        isEnded,
      },
    };

    LoggerWinston.log(
      `Event repetition fetched successfully`,
      apiId,
    );

    return response
      .status(HttpStatus.OK)
      .json(
        APIResponse.success(apiId, result, 'Event repetition fetched successfully'),
      );
  }

  /**
   * Update event by eventId - finds the first upcoming event repetition and updates it
   */
  async updateEventById(
    eventId: string,
    updateBody: UpdateEventDto,
    response: Response,
  ) {
    const apiId = API_ID.UPDATE_EVENT;
    
    // Find the event first
    const event = await this.findEventById(eventId);
    if (!event) {
      throw new NotFoundException(ERROR_MESSAGES.EVENT_NOT_FOUND);
    }

    // Check if event is archived
    const eventDetail = await this.getEventDetails(event.eventDetailId);
    if (eventDetail.status === 'archived') {
      throw new BadRequestException(ERROR_MESSAGES.CANNOT_EDIT_ARCHIVED_EVENTS);
    }

    // Find the first upcoming event repetition for this event
    const currentTimestamp = new Date();
    const firstUpcomingRepetition = await this.eventRepetitionRepository.findOne({
      where: {
        eventId: eventId,
        startDateTime: MoreThan(currentTimestamp),
        eventDetail: {
          status: Not('archived'),
        },
      },
      relations: ['eventDetail'],
      order: {
        startDateTime: 'ASC',
      },
    });

    if (!firstUpcomingRepetition) {
      throw new BadRequestException(ERROR_MESSAGES.EVENT_NOT_FOUND);
    }

    // Use the existing updateEvent method with the found repetition ID
    return this.updateEvent(firstUpcomingRepetition.eventRepetitionId, updateBody, response);
  }
}
