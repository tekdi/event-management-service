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
@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Events)
    private readonly eventRespository: Repository<Events>,
    @InjectRepository(EventDetail)
    private readonly eventDetailRepository: Repository<EventDetail>,
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
    if (createEventDto.isRestricted === true) {
      // private event

      if (createEventDto.eventType === 'online') {
        // create online event
        this.createOnlineEvent(createEventDto);
      } else if (createEventDto.eventType === 'offline') {
        // create offline event
        this.createOfflineEvent(createEventDto);
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

    const eventDetail = await this.createEventDetailDB(createEventDto);
    console.log(eventDetail, 'eventDetail');
    const event = await this.createEventDB(createEventDto, eventDetail);
    console.log(eventDetail, 'eventDetail');
    console.log(event, 'event');
    return response
      .status(HttpStatus.CREATED)
      .json(APIResponse.success(apiId, event, 'Created'));
    // } catch (error) {
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
    eventDetail.params = { attendees: createEventDto.attendees };
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
      recurrenceEndDate,
      registrationStartDate,
      registrationEndDate,
    } = createEventDto;
    const event = new Events();

    event.isRecurring = isRecurring;
    event.recurrenceEndDate = recurrenceEndDate
      ? new Date(recurrenceEndDate)
      : null;
    event.recurrencePattern = recurrencePattern ?? {};
    event.createdAt = new Date();
    event.updatedAt = new Date();
    console.log(event.createdAt, 'event.createdAt');
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

  validateCreateEventDto(createEventDto: CreateEventDto) {
    console.log(createEventDto, 'createEventDtogggggggg');
    // use pipes here https://chatgpt.com/share/88d5301b-5517-4f49-b81d-164757bcabfc
    if (createEventDto.isRestricted === true) {
      // private event
      console.log(createEventDto?.attendees, 'createEventDto');
    }

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

  createOfflineEvent(createEventDto: CreateEventDto) {
    // recurring & non-recurring
  }

  createRecurringEvent(createEventDto: CreateEventDto) {}

  createNonRecurringEvent(createEventDto: CreateEventDto) {}

  generateEventOccurences(createEventDto: CreateEventDto) {}

  // async getEventOccurrences(eventId: string): Promise<EventOccurrence[]> {
  //   return this.eventOccurrenceRepository.find({ where: { event: eventId } });
  // }
}
