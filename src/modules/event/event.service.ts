import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateResult } from './dto/update-event.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, MoreThan, MoreThanOrEqual } from 'typeorm';
import { Events } from './entities/event.entity';
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { SearchFilterDto } from './dto/search-event.dto';
import { AttendeesService } from '../attendees/attendees.service';
import { EventAttendeesDTO } from '../attendees/dto/EventAttendance.dto';
import { EventDetail } from './entities/eventDetail.entity';
import { ERROR_MESSAGES } from 'src/common/utils/constants.util';
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
import { DeleteResult, InsertResult } from 'typeorm';
import { DateValidationPipe } from 'src/common/pipes/event-validation.pipe';
@Injectable()
export class EventService {
  private eventCreationLimit: number;

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
  }

  async createEvent(
    createEventDto: CreateEventDto,
    response: Response,
  ): Promise<Response> {
    const apiId = 'api.create.event';
    try {
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

        // new approach of adding attendees against eventId
        await this.attendeesService.createAttendeesForEvents(
          createEventDto.attendees,
          createdEvent.res.eventId,
          createEventDto.createdBy,
        );
      } else {
        throw new NotImplementedException();
        // if event is public then registrationDate is required
        if (createEventDto.eventType === 'online') {
          // create online event
          // this.createOnlineEvent(createEventDto);
        } else if (createEventDto.eventType === 'offline') {
          // create offline event
          // this.createOfflineEvent(createEventDto);
        }
      }

      return response
        .status(HttpStatus.CREATED)
        .json(APIResponse.success(apiId, createdEvent.res, 'Created'));
    } catch (error) {
      console.log(error, 'error create event');
      throw error;
    }
  }

  async getEvents(response, requestBody) {
    const apiId = 'api.get.list';
    try {
      const { filters } = requestBody;
      const today = new Date();

      let finalquery = `SELECT 
      er."eventDetailId" AS "eventRepetition_eventDetailId", 
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
        delete event.total_count;
        const endDateTime = new Date(event.endDateTime);
        return {
          ...event,
          isEnded: endDateTime < today,
        };
      });
      if (finalResult.length === 0) {
        throw new NotFoundException('Event Not Found');
      }
      return response
        .status(HttpStatus.OK)
        .json(
          APIResponse.success(
            apiId,
            { totalCount, events: finalResult },
            'OK`',
          ),
        );
    } catch (error) {
      throw error;
    }
  }

  async createSearchQuery(filters, finalquery) {
    let whereClauses = [];

    // Handle specific date records
    if (filters?.date) {
      const startDate = filters?.date;
      const startDateTime = `${startDate} 00:00:00`;
      const endDateTime = `${startDate} 23:59:59`;
      whereClauses.push(
        `(er."startDateTime" <= '${endDateTime}'::timestamp AT TIME ZONE 'UTC' AND er."endDateTime" >= '${startDateTime}'::timestamp AT TIME ZONE 'UTC')`,
      );
    }

    // Handle startDate
    if (filters?.startDate && filters.endDate === undefined) {
      const startDate = filters?.startDate;
      const startDateTime = `${startDate} 00:00:00`;
      const endDateTime = `${startDate} 23:59:59`;
      whereClauses.push(
        `(er."startDateTime" <= '${endDateTime}' ::timestamp AT TIME ZONE 'UTC' AND er."startDateTime" >= '${startDateTime}' ::timestamp AT TIME ZONE 'UTC')`,
      );
    }

    if (filters?.startDate && filters.endDate) {
      const startDate = filters?.startDate;
      const startDateTime = `${startDate} 00:00:00`;
      const endDateTime = `${filters?.endDate} 23:59:59`;
      whereClauses.push(
        `(er."startDateTime" <= '${endDateTime}' ::timestamp AT TIME ZONE 'UTC' AND er."endDateTime" >= '${startDateTime}' ::timestamp AT TIME ZONE 'UTC')`,
      );
    }

    if (filters.endDate && filters.startDate === undefined) {
      const endDate = filters?.endDate;
      const startDateTime = `${endDate} 00:00:00`;
      const endDateTime = `${endDate} 23:59:59`;
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
    if (filters.status && filters.status.length > 0) {
      const statusConditions = filters.status
        .map((status) => `"status" = '${status}'`)
        .join(' OR ');
      whereClauses.push(`(${statusConditions})`);
    } else {
      // Add default status condition if no status is passed in the filter
      whereClauses.push(`"status" = 'live'`);
    }

    // Handle cohortId filter
    if (filters.cohortId) {
      whereClauses.push(`ed."metadata"->>'cohortId'='${filters.cohortId}'`);
    }

    // Construct final query
    if (whereClauses.length > 0) {
      finalquery += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    return finalquery;
  }

  async updateEvent(eventRepetitionId, updateBody, response) {
    const apiId = 'api.update.event';
    try {
      const currentTimestamp = new Date();
      const eventRepetition = await this.eventRepetitionRepository.findOne({
        where: { eventRepetitionId, startDateTime: MoreThan(currentTimestamp) },
      });
      if (!eventRepetition) {
        throw new NotFoundException('Event Not found');
      }

      const event = await this.eventRepository.findOne({
        where: { eventId: eventRepetition.eventId },
      });
      // condition for prevent non recuring event
      if (!event.isRecurring && !updateBody.isMainEvent) {
        throw new BadRequestException(
          'You can not pass isMainEvent false beacuse event is non recurring',
        );
      }
      const eventDetail = await this.eventDetailRepository.findOne({
        where: { eventDetailId: event.eventDetailId },
      });

      const validationResult = this.isInvalidUpdate(updateBody, eventDetail);
      if (!validationResult.isValid) {
        throw new BadRequestException(validationResult.message);
      }
      let result;
      if (updateBody?.isMainEvent) {
        // Handle updates or deletions for all recurrence records
        result = await this.handleAllEventUpdate(
          updateBody,
          event,
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
      return response
        .status(HttpStatus.OK)
        .json(APIResponse.success(apiId, result, 'OK'));
    } catch (error) {
      throw error;
    }
  }

  async handleAllEventUpdate(updateBody, event, eventRepetition) {
    const eventId = eventRepetition.eventId;
    const eventDetailId = event.eventDetailId;
    let updateResult: UpdateResult = {};

    // Handle recurring events
    if ((updateBody.startDatetime && updateBody.endDatetime) && event.isRecurring) {
      const recurrenceRecords = await this.eventRepetitionRepository.find({
        where: {
          eventId: eventId,
          startDateTime: MoreThanOrEqual(eventRepetition.startDateTime),
        },
      });
      const startDate = updateBody.startDatetime.split('T')[0];
      const endDate = updateBody.endDatetime.split('T')[0];
      const startTime = updateBody.startDatetime.split('T')[1];
      const endTime = updateBody.endDatetime.split('T')[1];
      let currentDate = eventRepetition.startDateTime
        .toISOString()
        .split('T')[0];
      if (startDate !== currentDate || endDate !== currentDate) {
        throw new BadRequestException(
          `Invalid Date pass Please pass ${currentDate}`,
        );
      }
      new DateValidationPipe().transform(updateBody);
      if (
        new Date(updateBody.startDatetime).getTime() !==
        new Date(eventRepetition.startDateTime).getTime() ||
        new Date(updateBody.endDatetime).getTime() !==
        new Date(eventRepetition.endDateTime).getTime()
      ) {
        const updateDateResult: {
          startDateTime?: () => string;
          endDateTime?: () => string;
          updatedAt?: Date;
        } = {};
        if (
          new Date(updateBody.startDatetime).getTime() !==
          new Date(eventRepetition.startDateTime).getTime()
        ) {
          updateDateResult.startDateTime = () =>
            `DATE_TRUNC('day', "startDateTime") + '${startTime}'::time`;
        }
        if (
          new Date(updateBody.endDatetime).getTime() !==
          new Date(eventRepetition.endDateTime).getTime()
        ) {
          updateDateResult.endDateTime = () =>
            `DATE_TRUNC('day', "endDateTime") + '${endTime}'::time`;
        }
        updateDateResult.updatedAt = new Date();
        const result = await this.eventRepetitionRepository.update(
          {
            eventRepetitionId: In(
              recurrenceRecords.map((record) => record.eventRepetitionId),
            ),
          },
          updateDateResult,
        );
        updateResult.recurrenceUpdate = result;
      }
    }
    // Handle non-recurring events
    if ((updateBody.startDatetime && updateBody.endDatetime) && !event.isRecurring) {
      new DateValidationPipe().transform(updateBody);
      eventRepetition.startDateTime = updateBody.startDatetime;
      eventRepetition.endDateTime = updateBody.endDatetime;
      eventRepetition.updatedAt = new Date();
      await this.eventRepetitionRepository.save(eventRepetition);
      updateResult.repetationDetail = eventRepetition;
    }

    // Handle onlineDetails or erMetaData updates
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

      await this.eventRepetitionRepository.update(
        { eventDetailId: eventDetailId },
        updateData
      );
    }

    // Handle event detail updates
    if (updateBody.title || updateBody.location || updateBody.latitude || updateBody.status || updateBody.onlineDetails) {
      const existingEventDetails = await this.eventDetailRepository.findOne({ where: { eventDetailId: eventDetailId } });
      if (updateBody.onlineDetails) {
        Object.assign(existingEventDetails.meetingDetails, updateBody.onlineDetails);
      }
      const startDateTime = eventRepetition.startDateTime;
      const recurrenceRecords = await this.eventRepetitionRepository.find({
        where: {
          eventId: eventId,
          eventDetailId: Not(eventDetailId),
          startDateTime: MoreThanOrEqual(startDateTime),
        },
      });

      if (recurrenceRecords.length > 0) {
        const updatedAt = new Date();
        await this.eventRepetitionRepository.update(
          {
            eventRepetitionId: In(
              recurrenceRecords.map((record) => record.eventRepetitionId),
            ),
          },
          { eventDetailId: eventDetailId, updatedAt: updatedAt },
        );

        await this.eventDetailRepository.delete({
          eventDetailId: In(
            recurrenceRecords.map((record) => record.eventDetailId),
          ),
        });
      }

      Object.assign(existingEventDetails, updateBody, {
        eventRepetitionId: eventRepetition.eventRepetitionId,
      });
      existingEventDetails.updatedAt = new Date();
      const result =
        await this.eventDetailRepository.save(existingEventDetails);
      updateResult.eventDetails = result;
    }
    return updateResult;
  }

  async handleSpecificRecurrenceUpdate(updateBody, event, eventRepetition) {
    let updateResult: UpdateResult = {};
    if (updateBody?.startDatetime && updateBody?.endDatetime) {
      const startDate = updateBody.startDatetime.split('T')[0];
      const endDate = updateBody.endDatetime.split('T')[0];
      if (startDate !== endDate) {
        throw new BadRequestException(
          'Start Date and End Date should be equal',
        );
      }
      new DateValidationPipe().transform(updateBody);
      eventRepetition.startDateTime = updateBody.startDatetime;
      eventRepetition.endDateTime = updateBody.endDatetime;
      eventRepetition.updatedAt = new Date();
      await this.eventRepetitionRepository.save(eventRepetition);
      updateResult.repetationDetail = eventRepetition;
    }
    const eventDetailId = eventRepetition.eventDetailId;
    const existingEventDetails = await this.eventDetailRepository.findOne({
      where: { eventDetailId: eventDetailId },
    });
    existingEventDetails.updatedAt = new Date();

    if (updateBody.title || updateBody.location || updateBody.latitude || updateBody.status || updateBody.onlineDetails) {
      if (updateBody.onlineDetails) {
        Object.assign(existingEventDetails.meetingDetails, updateBody.onlineDetails)
      }
      if (event.eventDetailId === existingEventDetails.eventDetailId) {
        if (existingEventDetails.status === 'archived') {
          throw new BadRequestException('Event is already archived');
        }

        Object.assign(existingEventDetails, updateBody, { eventRepetitionId: eventRepetition.eventRepetitionId });
        delete existingEventDetails.eventDetailId;
        const result =
          await this.eventDetailRepository.save(existingEventDetails);
        eventRepetition.eventDetailId = result.eventDetailId;
        eventRepetition.updatedAt = new Date();
        await this.eventRepetitionRepository.save(eventRepetition);
        updateResult.eventDetails = result;
      } else {
        Object.assign(existingEventDetails, updateBody, {
          eventRepetitionId: eventRepetition.eventRepetitionId,
        });
        const result =
          await this.eventDetailRepository.save(existingEventDetails);
        updateResult.eventDetails = result;
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

  isInvalidUpdate(updateBody, eventDetail) {
    if (updateBody.location || (updateBody.latitude && updateBody.longitude)) {
      if (eventDetail.eventType === 'online') {
        return {
          isValid: false,
          message:
            'Cannot update location or lat or long details for an online event',
        };
      }
    }

    if (updateBody.onlineDetails) {
      if (eventDetail.eventType === 'offline') {
        return {
          isValid: false,
          message: 'Cannot update online details for an offline event',
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

    if (recurrencePattern?.endCondition?.value) {
      recurrencePattern.recurringStartDate = createEventDto.startDatetime;
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
    if (createEventDto.eventType === EventTypes.online) {
      eventRepetition.onlineDetails['occurenceId'] = '';
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

  createRepetitionOccurence(
    createEventDto: CreateEventDto,
    eventDetailId: string,
    eventId: string,
  ): EventRepetition {
    const eventRepetition = new EventRepetition();
    eventRepetition.eventDetailId = eventDetailId;
    eventRepetition.eventId = eventId;
    eventRepetition.onlineDetails = createEventDto.meetingDetails;
    if (createEventDto.eventType === EventTypes.online) {
      eventRepetition.onlineDetails['occurenceId'] = '';
    }
    eventRepetition.erMetaData = createEventDto.erMetaData ?? {};
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
    try {
      if (createEventDto.eventType === EventTypes.offline) {
        // create offline event
        createEventDto.onlineProvider = null;
        createEventDto.meetingDetails = null;
        createEventDto.recordings = null;
      } else if (createEventDto.eventType === EventTypes.online) {
        createEventDto.meetingDetails.providerGenerated = false;
      }

      const createdEventDetailDB =
        await this.createEventDetailDB(createEventDto);

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
        // this.createNonRecurringEvent(createEventDto);
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
    } catch (error) {
      console.log(error, 'error');
      throw error;
    }
  }

  async createRecurringEvents(
    createEventDto: CreateEventDto,
    eventId: string,
    eventDetailId: string,
  ) {
    const eventOccurences = this.generateEventOccurences(
      createEventDto,
      eventDetailId,
      eventId,
    );

    if (!(this.eventCreationLimit > 0)) {
      const errmsg = 'Event creation limit unavailable';
      await this.removePartiallyCreatedData(eventId, eventDetailId);
      throw new BadRequestException(errmsg);
    }

    if (eventOccurences.length > this.eventCreationLimit) {
      await this.removePartiallyCreatedData(eventId, eventDetailId);
      throw new BadRequestException('Event Creation Count exceeded');
    } else if (eventOccurences.length <= 0) {
      await this.removePartiallyCreatedData(eventId, eventDetailId);
      throw new BadRequestException('Event recurrence period insufficient');
    } else {
      const insertedOccurences = await this.eventRepetitionRepository
        .createQueryBuilder()
        .insert()
        .into('EventRepetition')
        .values(eventOccurences)
        .returning(['onlineDetails', 'erMetaData'])
        .execute();
      // const insertedOccurences =
      //   await this.eventRepetitionRepository.insert(eventOccurences);
      return insertedOccurences;
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

  async getEventOccurrences(eventId: string): Promise<EventRepetition[]> {
    return this.eventRepetitionRepository.find({ where: { eventId: eventId } });
  }

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

    let currentDate = new Date(startDate.split('T')[0] + 'T' + startTime);

    const addDays = (date: Date, days: number): Date => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };

    const getNextValidDay = (
      currentDay: number,
      daysOfWeek: DaysOfWeek[],
    ): number => {
      for (let i = 0; i < daysOfWeek.length; i++) {
        if (daysOfWeek[i] > currentDay) {
          return daysOfWeek[i] - currentDay;
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
      const eventRec = this.createRepetitionOccurence(
        createEventDto,
        eventDetailId,
        eventId,
      );

      if (config.frequency === Frequency.daily) {
        const endDtm = currentDate.toISOString().split('T')[0] + 'T' + endTime;

        eventRec.startDateTime = new Date(currentDate);
        eventRec.endDateTime = new Date(endDtm);
        occurrences.push(eventRec);
        currentDate = addDays(currentDate, config.interval);
      } else if (config.frequency === Frequency.weekly) {
        const currentDay = currentDate.getDay();
        const daysUntilNextOccurrence = getNextValidDay(
          currentDay,
          config.daysOfWeek,
        );
        currentDate = addDays(currentDate, daysUntilNextOccurrence);
        const endDtm = currentDate.toISOString().split('T')[0] + 'T' + endTime;

        eventRec.startDateTime = new Date(currentDate);
        eventRec.endDateTime = new Date(endDtm);
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

  async deleteEvent(eventId: string): Promise<DeleteResult> {
    return this.eventRepository.delete({ eventId });
  }

  async deleteEventDetail(eventDetailId: string): Promise<DeleteResult> {
    return this.eventDetailRepository.delete({ eventDetailId });
  }

  async removePartiallyCreatedData(
    eventId: string,
    eventDetailId: string,
  ): Promise<PromiseSettledResult<undefined | DeleteResult>[]> {
    const promises = [
      this.deleteEvent(eventId),
      this.deleteEventDetail(eventDetailId),
    ];

    const responses = await Promise.allSettled(promises);
    return responses;
  }
}
