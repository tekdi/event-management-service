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
@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Events)
    private readonly eventRespository: Repository<Events>,
    @InjectRepository(EventDetail)
    private readonly eventDetailRepository: Repository<EventDetail>,
    @InjectRepository(EventRepetition)
    private readonly eventRepetitionRepository: Repository<EventRepetition>,
    private readonly attendeesService: AttendeesService,
  ) {}

  async createEvent(
    createEventDto: CreateEventDto,
    userId: string,
    response: Response,
  ): Promise<Response> {
    const apiId = 'api.create.event';
    // try {
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
        console.log(createdEvent, 'createdEvent');
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
    // } catch (error) {
    //   console.log(error, 'error create event');
    //   return response
    //     .status(HttpStatus.INTERNAL_SERVER_ERROR)
    //     .json(
    //       APIResponse.error(
    //         apiId,
    //         ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    //         error,
    //         '500',
    //       ),
    //     );
    // }
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
    console.log(
      eventDetail,
      'eventDetail before save',
      getTimezoneDate('Asia/Kolkata', new Date()),
    );
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
    // const configDaily = {
    //   frequency: 'daily',
    //   interval: 1,
    //   endCondition: {
    //     type: 'endDate',
    //     value: '2024-07-31',
    //   },
    // };
    const eventRepetition = new EventRepetition();
    eventRepetition.event = event;
    eventRepetition.eventDetail = eventDetail;
    eventRepetition.onlineDetails = createEventDto.meetingDetails;
    eventRepetition.startDateTime = new Date(createEventDto.startDatetime);
    eventRepetition.endDateTime = new Date(createEventDto.endDatetime);
    // eventRepetition.createdAt = new Date();
    // eventRepetition.updatedAt = new Date();
    return this.eventRepetitionRepository.save(eventRepetition);
  }

  validateCreateEventDto(createEventDto: CreateEventDto) {
    console.log(createEventDto, 'createEventDtogggggggg');

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
        this.createRecurringEvent(
          createEventDto,
          event.eventId,
          eventDetail.eventDetailId,
        );
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

  createRecurringEvent(
    createEventDto: CreateEventDto,
    eventId: string,
    eventDetailId: string,
  ) {
    // const eventOccurrences = this.generateEventOccurrences(createEventDto);
    // eventOccurrences.forEach((eventOccurrence) => {
    //   // Save event occurrence
    //   this.eventOccurrenceRepository.save(eventOccurrence);
    // });
    const eocc = this.generateEventOccurences(
      createEventDto,
      createEventDto.recurrencePattern,
      createEventDto.startDatetime,
    );
    console.log(eocc, 'eocc');
  }

  createNonRecurringEvent(createEventDto: CreateEventDto) {}

  // generateEventOccurences(createEventDto: CreateEventDto) {}

  // generateEventOccurrences(createEventDto: CreateEventDto): EventRepetition[] {
  //   const { startDate, endDate } = createEventDto;
  //   const eventOccurrences: EventRepetition[] = [];

  //   // Validate start date and end date
  //   if (!startDate || !endDate) {
  //     throw new BadRequestException('Start date and end date are required');
  //   }

  //   // Generate event occurrences based on start date and end date
  //   let currentDate = new Date(startDate);
  //   while (currentDate <= new Date(endDate)) {
  //     const eventOccurrence: EventOccurrence = {
  //       eventId: createEventDto.eventId,
  //       occurrenceDate: currentDate,
  //     };
  //     eventOccurrences.push(eventOccurrence);

  //     // Increment current date by one day
  //     currentDate.setDate(currentDate.getDate() + 1);
  //   }

  //   return eventOccurrences;
  // }

  async getEventOccurrences(eventId: string): Promise<EventRepetition[]> {
    return this.eventRepetitionRepository.find({ where: { eventId: eventId } });
  }
  // async getEventOccurrences(eventId: string): Promise<EventOccurrence[]> {
  //   return this.eventOccurrenceRepository.find({ where: { event: eventId } });
  // }

  generateEventOccurences(
    createEventDto: CreateEventDto,
    config: any,
    startDate: string,
  ) {
    const occurrences = [];
    let currentDate = new Date(startDate);

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
      occurrences,
    ) => {
      if (endCondition.type === 'endDate') {
        return (
          new Date(occurrences[occurrences.length - 1]) >
          new Date(endCondition.value)
        );
      } else if (endCondition.type === 'occurrences') {
        return occurrences.length >= endCondition.value;
      }
      return false;
    };

    while (!endConditionMet(config.endCondition, occurrences)) {
      occurrences.push(new Date(currentDate).toISOString().split('T')[0]);

      if (config.frequency === 'daily') {
        currentDate = addDays(currentDate, config.interval);
      } else if (config.frequency === 'weekly') {
        currentDate = addWeeks(currentDate, config.interval, config.daysOfWeek);
      }
    }

    // Remove the last occurrence if it exceeds the end date condition
    if (
      config.endCondition.type === 'endDate' &&
      new Date(occurrences[occurrences.length - 1]) >
        new Date(config.endCondition.value)
    ) {
      occurrences.pop();
    }

    return occurrences;
  }
}
