import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
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
  DeadlineValidationPipe,
  ParamsValidationPipe,
} from 'src/common/pipes/event-validation.pipe';
import { AttendeesService } from '../attendees/attendees.service';
import { EventAttendeesDTO } from '../attendees/dto/EventAttendance.dto';
import { EventDetail } from './entities/eventDetail.entity';
@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Events)
    private readonly eventRespository: Repository<Events>,
    @InjectRepository(EventDetail)
    private readonly eventDetailRepository: Repository<EventDetail>,
    private readonly attendeesService: AttendeesService,
  ) { }

  async createEvent(
    createEventDto: CreateEventDto,
    userId: string,
    response: Response,
  ): Promise<Response> {
    const apiId = 'api.create.event';
    try {
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
        // if event is public then registrationDate is required
        if (createEventDto.eventType === 'online') {
          // create online event
          this.createOnlineEvent(createEventDto);
        } else if (createEventDto.eventType === 'offline') {
          // create offline event
          this.createOfflineEvent(createEventDto);
        }
      }

      const eventDetail = await this.createEventDetail(createEventDto);
    } catch (error) {
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json(APIResponse.error(apiId, 'Internal Server Error', error, '500'));
    }
  }

  async createEvents(createEventDto, response) { }

  async createEventDetail(
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
    eventDetail.params = createEventDto.params;
    eventDetail.meetingDetails = createEventDto.meetingDetails;
    eventDetail.idealTime = createEventDto.idealTime;
    eventDetail.metadata = createEventDto.metaData;
    eventDetail.createdBy = createEventDto.createdBy;
    eventDetail.updatedBy = createEventDto.updatedBy;
    eventDetail.createdAt = new Date();
    eventDetail.updatedAt = new Date();

    return this.eventDetailRepository.save(eventDetail);
  }

  validateCreateEventDto(createEventDto: CreateEventDto) {
    if (createEventDto.isRestricted === true) {
      // private event

      // if event is private then invitees are required
      if (!createEventDto?.params?.invitees.length) {
        throw new BadRequestException('Invitees required for private event');
      }
    } else {
      // if event is public then registration is required
      if (createEventDto?.params?.invitees.length) {
        throw new BadRequestException('Invitees not required for public event');
      }

      if (!createEventDto.registrationStartDate) {
        throw new BadRequestException(
          'Registration Start Date required for event',
        );
      }
    }

    if (createEventDto.isRecurring) {
      // recurring event
      if (!createEventDto.recurrencePattern) {
        throw new BadRequestException('Recurrence Pattern required for event');
      }

    } else {
      // non recurring event

    }

    if (createEventDto.eventType === 'offline') {
      if (!createEventDto.location) {
        throw new BadRequestException('Location required for offline event');
      }
    } else if (createEventDto.eventType === 'online') {
      if (!createEventDto.onlineProvider) {
        throw new BadRequestException(
          'Online Provider required for online event',
        );
      }
    }
  }

  createOnlineEvent(createEventDto: CreateEventDto) {
    // recurring & non-recurring
  }

  createOfflineEvent(createEventDto: CreateEventDto) {
    // recurring & non-recurring
  }

  createRecurringEvent(createEventDto: CreateEventDto) { }

  createNonRecurringEvent(createEventDto: CreateEventDto) { }

  generateEventOccurences(createEventDto: CreateEventDto) { }

  // async getEventOccurrences(eventId: string): Promise<EventOccurrence[]> {
  //   return this.eventOccurrenceRepository.find({ where: { event: eventId } });
  // }
}
