import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Events } from './entities/event.entity';
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { SearchFilterDto } from './dto/search-event.dto';
import {
  DateValidationPipe,
  RegistrationDateValidationPipe,
} from 'src/common/pipes/event-validation.pipe';
import { AttendeesService } from '../attendees/attendees.service';
import { EventAttendeesDTO } from '../attendees/dto/EventAttendance.dto';
import { EventDetail } from './entities/eventDetail.entity';
import { ERROR_MESSAGES } from 'src/common/utils/constants.util';
import { getTimezoneDate } from 'src/common/utils/pipe.util';
import { EventRepetition } from './entities/eventRepetition.entity';
import { RecurrencePattern } from 'src/common/utils/types';
import { ConfigService } from '@nestjs/config';
import { TimeZoneTransformer } from 'src/common/utils/transformer/date.transformer';
@Injectable()
export class EventService {
  private eventCreationLimit: number;
  constructor(
    @InjectRepository(Events)
    private readonly eventRespository: Repository<Events>,
    @InjectRepository(EventDetail)
    private readonly eventDetailRepository: Repository<EventDetail>,
    @InjectRepository(EventRepetition)
    private readonly eventRepetitionRepository: Repository<EventRepetition>,
    private readonly attendeesService: AttendeesService,
    private readonly configService: ConfigService,
    private timeZoneTransformer: TimeZoneTransformer,
  ) {
    this.eventCreationLimit = this.configService.get<number>(
      'EVENT_CREATION_LIMIT',
    );
    this.timeZoneTransformer = new TimeZoneTransformer(this.configService);
  }

  async createEvent(
    createEventDto: CreateEventDto,
    userId: string,
    response: Response,
  ): Promise<Response> {
    const apiId = 'api.create.event';
    try {
      this.validateCreateEventDto(createEventDto);
      // true for private, false for public
      let createdEvent;
      if (createEventDto.isRestricted === true) {
        // private event

        if (createEventDto.eventType === 'online') {
          // create online event
          this.createOnlineEvent(createEventDto);
        } else if (createEventDto.eventType === 'offline') {
          // create offline event
          createdEvent = await this.createOfflineEvent(createEventDto);
        }

        // if event is private then invitees are required
        // add invitees to attendees table
      } else {
        throw new NotImplementedException();
        // if event is public then registrationDate is required
        if (createEventDto.eventType === 'online') {
          // create online event

          this.createOnlineEvent(createEventDto);
        } else if (createEventDto.eventType === 'offline') {
          // create offline event
          this.createOfflineEvent(createEventDto);
        }
      }

      return response
        .status(HttpStatus.CREATED)
        .json(APIResponse.success(apiId, createdEvent, 'Created'));
    } catch (error) {
      console.log(error, 'error create event');
      throw error;
      // return response
      //   .status(HttpStatus.INTERNAL_SERVER_ERROR)
      //   .json(
      //     APIResponse.error(
      //       apiId,
      //       ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      //       error,
      //       '500',
      //     ),
      //   );
    }
  }

  async getEvents(response, requestBody) {
    const apiId = 'api.get.list';
    try {
      const { filters } = requestBody;
      const today = new Date();
      let finalquery = `SELECT *,COUNT(*) OVER() AS total_count  FROM public."EventRepetition"  AS er
      LEFT JOIN "EventDetails" AS ed ON er."eventDetailId"=ed."eventDetailId" 
      LEFT JOIN "Events" AS e ON er."eventId"=e."eventId"`;

      //User not pass any things then it show today and upcoming event
      if (!filters || Object.keys(filters).length === 0) {
        finalquery += ` WHERE DATE(er."startDateTime") >= CURRENT_DATE
        OR DATE(er."endDateTime") > CURRENT_DATE`;
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

      // Add isEnded key based on endDateTime
      const finalResult = result.map((event) => {
        const startDateTime = new Date(event.startDateTime);
        const endDateTime = new Date(event.endDateTime);
        return {
          ...event,
          startDateTime: this.timeZoneTransformer.from(startDateTime),
          endDateTime: this.timeZoneTransformer.from(endDateTime),
          isEnded: endDateTime < today,
        };
      });
      if (finalResult.length === 0) {
        return response
          .status(HttpStatus.NOT_FOUND)
          .json(
            APIResponse.error(
              apiId,
              'Event Not Found',
              'No records found.',
              'NOT_FOUND',
            ),
          );
      }
      return response
        .status(HttpStatus.OK)
        .json(
          APIResponse.success(
            apiId,
            { totalCount: finalResult[0].total_count, events: finalResult },
            'OK`',
          ),
        );
    } catch (error) {
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json(
          APIResponse.error(
            apiId,
            ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
            error,
            '500',
          ),
        );
    }
  }
  async createSearchQuery(filters, finalquery) {
    let whereClauses = [];

    // Handle startDate and optionally endDate
    if (filters.startDate) {
      const startDate = filters.startDate;
      const startDateTime = `${startDate} 00:00:00`;
      const endDateTime = filters.endDate
        ? `${filters.endDate} 23:59:59`
        : `${startDate} 23:59:59`;
      whereClauses.push(
        `(er."startDateTime" <= '${endDateTime}' AND er."endDateTime" >= '${startDateTime}')`,
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
    if (filters.status && filters.status.length > 0) {
      const statusConditions = filters.status
        .map((status) => `"status" = '${status}'`)
        .join(' OR ');
      whereClauses.push(`(${statusConditions})`);
    }

    // Construct final query
    if (whereClauses.length > 0) {
      finalquery += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    return finalquery;
  }

  async createEvents(createEventDto, response) {}

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
    eventDetail.maxAttendees = createEventDto.maxAttendees;
    eventDetail.recordings = createEventDto.recordings;
    eventDetail.status = createEventDto.status;
    eventDetail.attendees = createEventDto.attendees.length
      ? createEventDto.attendees
      : null;
    eventDetail.meetingDetails = createEventDto.meetingDetails;
    eventDetail.idealTime = createEventDto.idealTime;
    eventDetail.metadata = createEventDto.metaData;
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

    return this.eventRespository.save(event);
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
    eventRepetition.startDateTime = new Date(createEventDto.startDatetime);
    eventRepetition.endDateTime = new Date(createEventDto.endDatetime);
    eventRepetition.createdBy = createEventDto.createdBy;
    eventRepetition.updatedBy = createEventDto.updatedBy;
    eventRepetition.createdAt = new Date();
    eventRepetition.updatedAt = new Date();
    return this.eventRepetitionRepository.save(eventRepetition);
  }

  createRepetitionOccurence(
    createEventDto: CreateEventDto,
    eventDetailId: string,
    eventId: string,
  ): EventRepetition {
    const eventRepetition = new EventRepetition();
    eventRepetition.eventDetailId = eventDetailId;
    eventRepetition.eventId = eventId;
    eventRepetition.onlineDetails = createEventDto.meetingDetails;
    eventRepetition.startDateTime = null;
    eventRepetition.endDateTime = null;
    eventRepetition.createdBy = createEventDto.createdBy;
    eventRepetition.updatedBy = createEventDto.updatedBy;
    eventRepetition.createdAt = new Date();
    eventRepetition.updatedAt = new Date();

    return eventRepetition;
  }

  validateCreateEventDto(createEventDto: CreateEventDto) {
    if (createEventDto.isRecurring) {
      // recurring event
      if (!createEventDto.recurrencePattern) {
        throw new BadRequestException(
          ERROR_MESSAGES.RECURRING_PATTERN_REQUIRED,
        );
      }
    } else {
      // non recurring event
    }

    // if (createEventDto.eventType === 'offline') {
    //   if (!createEventDto.location) {
    //     throw new BadRequestException('Location required for offline event');
    //   }
    // } else if (createEventDto.eventType === 'online') {
    //   if (!createEventDto.onlineProvider) {
    //     throw new BadRequestException(
    //       'Online Provider required for online event',
    //     );
    //   }
    // }
  }

  createOnlineEvent(createEventDto: CreateEventDto) {
    // recurring & non-recurring
    throw new NotImplementedException();
  }

  async createOfflineEvent(createEventDto: CreateEventDto) {
    // recurring & non-recurring
    try {
      createEventDto.onlineProvider = null;
      createEventDto.meetingDetails = null;
      createEventDto.recordings = null;
      const eventDetail = await this.createEventDetailDB(createEventDto);
      console.log(eventDetail, 'eventDetail');
      const event = await this.createEventDB(createEventDto, eventDetail);
      console.log(event, 'event');

      if (createEventDto.isRecurring) {
        const erep = await this.createRecurringEvent(
          createEventDto,
          event.eventId,
          eventDetail.eventDetailId,
        );
        console.log(erep, 'eeeeeeeerrrrrrrrreepp');
      } else {
        // this.createNonRecurringEvent(createEventDto);
        const erep = await this.createEventRepetitionDB(
          createEventDto,
          event,
          eventDetail,
        );
        return erep;
      }
    } catch (error) {
      console.log(error, 'error');
      throw error;
    }
  }

  async createRecurringEvent(
    createEventDto: CreateEventDto,
    eventId: string,
    eventDetailId: string,
  ) {
    // const eventOccurrences = this.generateEventOccurrences(createEventDto);
    // eventOccurrences.forEach((eventOccurrence) => {
    //   // Save event occurrence
    //   this.eventOccurrenceRepository.save(eventOccurrence);
    // });
    const eventOccurences = this.generateEventOccurences(
      createEventDto,
      eventDetailId,
      eventId,
    );
    console.log(
      eventOccurences.length > this.eventCreationLimit,
      eventOccurences.length,
      typeof this.eventCreationLimit,
      this.eventCreationLimit,
    );
    if (eventOccurences.length > this.eventCreationLimit) {
      throw new BadRequestException('Event Creation Count exceeded');
    } else {
      const insertedOccurences =
        await this.eventRepetitionRepository.insert(eventOccurences);
    }
  }

  createNonRecurringEvent(createEventDto: CreateEventDto) {}

  async getEventOccurrences(eventId: string): Promise<EventRepetition[]> {
    return this.eventRepetitionRepository.find({ where: { eventId: eventId } });
  }
  // async getEventOccurrences(eventId: string): Promise<EventOccurrence[]> {
  //   return this.eventOccurrenceRepository.find({ where: { event: eventId } });
  // }

  generateEventOccurences(
    createEventDto: CreateEventDto,
    eventDetailId: string,
    eventId: string,
  ) {
    const config = createEventDto.recurrencePattern;
    const startDate = createEventDto.startDatetime;

    const occurrences: EventRepetition[] = [];
    const startTime = createEventDto.startDatetime.split('T')[1];
    const endTime = createEventDto.endDatetime.split('T')[1];
    // let currentDate = new Date(startDate);
    let currentDate = new Date(startDate.split('T')[0] + 'T' + startTime);

    const addDays = (date, days) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };

    const addWeeks = (date, weeks, daysOfWeek) => {
      const result = new Date(date);
      const nextValidDay = daysOfWeek.find((day) => day > result.getDay());
      result.setDate(
        result.getDate() +
          (nextValidDay !== undefined
            ? nextValidDay - result.getDay()
            : 7 * weeks - result.getDay() + daysOfWeek[0]),
      );
      return result;
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
      } else if (endCondition.type === 'occurrences') {
        return occurrences1.length >= parseInt(endCondition.value);
      }
      return false;
    };

    while (!endConditionMet(config.endCondition, occurrences)) {
      const eventRec = this.createRepetitionOccurence(
        createEventDto,
        eventDetailId,
        eventId,
      );

      const endDtm = currentDate.toISOString().split('T')[0] + 'T' + endTime;

      eventRec.startDateTime = new Date(currentDate);
      eventRec.endDateTime = new Date(addDays(new Date(endDtm), 1));
      occurrences.push(eventRec);

      if (config.frequency === 'daily') {
        currentDate = addDays(currentDate, config.interval);
      } else if (config.frequency === 'weekly') {
        currentDate = addWeeks(currentDate, config.interval, config.daysOfWeek);
      }
    }

    // Remove the last occurrence if it exceeds the end date condition

    if (
      config.endCondition.type === 'endDate' &&
      occurrences[occurrences.length - 1]?.endDateTime >
        new Date(config.endCondition.value + 'T' + endTime)
    ) {
      const pop = occurrences.pop();
    }

    return occurrences;
  }
}
