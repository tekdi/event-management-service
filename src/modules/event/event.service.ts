import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
  NotImplementedException,
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
import { AttendeesService } from '../attendees/attendees.service';
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
} from 'src/common/utils/types';
import { ConfigService } from '@nestjs/config';
import {
  DateValidationPipe,
  RecurringEndDateValidationPipe,
} from 'src/common/pipes/event-validation.pipe';
import { compareArrays } from 'src/common/utils/functions.util';
import * as moment from 'moment-timezone';
import { LoggerWinston } from 'src/common/logger/logger.util';

@Injectable()
export class EventService {
  private readonly eventCreationLimit: number;
  private readonly timezone: string;

  constructor(
    @InjectRepository(Events)
    private readonly eventRepository: Repository<Events>,
    @InjectRepository(EventDetail)
    private readonly eventDetailRepository: Repository<EventDetail>,
    @InjectRepository(EventRepetition)
    private readonly eventRepetitionRepository: Repository<EventRepetition>,
    private readonly attendeesService: AttendeesService,
    private readonly configService: ConfigService,
  ) {
    this.eventCreationLimit = this.configService.get<number>(
      'EVENT_CREATION_LIMIT',
    );
    this.timezone = this.configService.get<string>('TIMEZONE');
  }

  async createEvent(
    createEventDto: CreateEventDto,
    response: Response,
  ): Promise<Response> {
    const apiId = API_ID.CREATE_EVENT;
    this.validateTimezone();

    // this.validateCreateEventDto(createEventDto);
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
      throw new NotImplementedException(ERROR_MESSAGES.PUBLIC_EVENTS);
      // TODO: if event is public then registrationDate is required
      // if (createEventDto.eventType === 'online') {
      // create online event
      // this.createOnlineEvent(createEventDto);
      // } else if (createEventDto.eventType === 'offline') {
      // create offline event
      // this.createOfflineEvent(createEventDto);
      // }
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
    let whereClauses = [];

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

    let updateResult: UpdateResult = {};
    let updatedEvents;
    let eventAndEventDetails: {
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
      updateResult.repetitionDetail = eventRepetition;
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

    // Handle onlineDetails or erMetaData updates for single recurring event
    if (updateBody.onlineDetails || updateBody.erMetaData) {
      const updateData: any = { updatedAt: new Date() };
      if (updateBody.onlineDetails) {
        Object.assign(eventRepetition.onlineDetails, updateBody.onlineDetails);
        updateData.onlineDetails = eventRepetition.onlineDetails;
        updateResult.onlineDetails = updateBody.onlineDetails;
      }

      if (updateBody.erMetaData) {
        Object.assign(eventRepetition.erMetaData, updateBody.erMetaData);
        updateData.erMetaData = eventRepetition.erMetaData;
        updateResult.erMetaData = updateBody.erMetaData;
      }
      updateResult.updatedRecurringEvent = await this.updateEventRepetition(
        recurrenceRecords,
        updateData,
      );
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
    let updateResult = {};

    // Get event which eventDetailId is diffrent from main eventDetailId from eventRepetation table[use for delete]
    const upcomingrecurrenceRecords = await this.getUpcomingRecurrenceRecords(
      event.eventId,
      eventDetail.eventDetailId,
      eventRepetition.startDateTime,
    );
    const existingEventDetails = eventDetail;

    if (updateBody.onlineDetails) {
      Object.assign(
        existingEventDetails.meetingDetails,
        updateBody.onlineDetails,
      );
    }
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
        const numberOfEntryInEventReperationTable =
          await this.getEventRepetitionOccurrences(
            eventRepetition.eventDetailId,
          );

        if (updateBody.onlineDetails) {
          Object.assign(
            repetationeventDetailexistingResult['meetingDetails'],
            updateBody.onlineDetails,
          );
        }
        if (numberOfEntryInEventReperationTable.length === 1) {
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

        // update eventDetail id in all places which are greater than and equal to curreitn repetation startDate in repetation table
        if (recurrenceRecords.length > 0) {
          const updatedEventRepetition = await this.updateEventRepetition(
            recurrenceRecords,
            {
              eventDetailId: neweventDetailsId,
            },
          );
          updateResult['updatedEvents'] = updatedEventRepetition.affected;
        }
      }
    }

    return updateResult;
  }

  async handleSpecificRecurrenceUpdate(updateBody, event, eventRepetition) {
    let updateResult: UpdateResult = {};
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
      if (updateBody.onlineDetails) {
        Object.assign(
          existingEventDetails.meetingDetails,
          updateBody.onlineDetails,
        );
      }

      if (event.eventDetailId === existingEventDetails.eventDetailId) {
        // as we are updating event from set of events we will make its details separate
        Object.assign(existingEventDetails, updateBody, {
          eventRepetitionId: eventRepetition.eventRepetitionId,
        });
        existingEventDetails.eventDetailId = undefined;

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
    if (updateBody.onlineDetails || updateBody.erMetaData) {
      if (updateBody.onlineDetails) {
        Object.assign(eventRepetition.onlineDetails, updateBody.onlineDetails);
        updateResult.onlineDetails = updateBody.onlineDetails;
      }
      if (updateBody.erMetaData) {
        Object.assign(eventRepetition.erMetaData, updateBody.erMetaData);
        updateResult.erMetaData = updateBody.erMetaData;
      }
      eventRepetition.updatedAt = new Date();
      await this.eventRepetitionRepository.save(eventRepetition);
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

    if (updateBody.onlineDetails) {
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
    eventDetail.description = createEventDto.description;
    eventDetail.shortDescription = createEventDto.shortDescription;
    eventDetail.eventType = createEventDto.eventType;
    eventDetail.isRestricted = createEventDto.isRestricted;
    eventDetail.location = createEventDto.location;
    eventDetail.longitude = createEventDto.longitude;
    eventDetail.latitude = createEventDto.latitude;
    eventDetail.onlineProvider = createEventDto.onlineProvider;
    eventDetail.maxAttendees = createEventDto?.maxAttendees;
    eventDetail.recordings = createEventDto?.recordings;
    eventDetail.status = createEventDto.status;
    eventDetail.attendees = createEventDto?.attendees?.length
      ? createEventDto.attendees
      : null;
    eventDetail.meetingDetails = createEventDto.meetingDetails;
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
      if (createEventDto.isMeetingNew === false) {
        createEventDto.meetingDetails.providerGenerated = false;
      } else {
        throw new NotImplementedException(
          'Auto Generated Meetings not implemented',
        );
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

    // if we convert to local time and then genererate occurrences
    let currentDateUTC = new Date(startDate);

    let currentDate = new Date(
      currentDateUTC.toLocaleString('en-US', { timeZone: this.timezone }),
    ); // Convert to given timezone

    const currentEnd = new Date(endDate);

    let endDateTimeZoned = new Date(
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
}
