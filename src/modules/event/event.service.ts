import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Events } from './entities/event.entity';
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { SearchFilterDto } from './dto/search-event.dto';
import { DateValidationPipe, DeadlineValidationPipe, ParamsValidationPipe } from 'src/common/pipes/event-validation.pipe';
import { AttendeesService } from '../attendees/attendees.service';
import { EventAttendeesDTO } from '../attendees/dto/EventAttendance.dto';
import { CohortMember } from './entities/CohortMembers.entity';
import { Cohort } from './entities/Cohort.entity';
import { Users } from './entities/Users.entity';
import { MeetingsService } from '../meetings/meetings.service';
import { CreateMeetingDto } from '../meetings/dto/create-Meeting.dto';
import { APIID } from 'src/common/utils/api-id.config';

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Events)
    private readonly eventRespository: Repository<Events>,
    @InjectRepository(CohortMember)
    private readonly cohortMemberRepo: Repository<CohortMember>,
    @InjectRepository(Cohort)
    private readonly cohortRepo: Repository<Cohort>,
    @InjectRepository(Users)
    private readonly usersRepo: Repository<Users>,
    private readonly attendeesService: AttendeesService,
    private readonly meetingsService: MeetingsService
  ) { }
  async createEvent(createEventDto: CreateEventDto, userId: string, response: Response): Promise<void> {
    const apiId = APIID.EVENT_CREATE;
    try {
      // checkl if isRistricted true then check cohorts id or user id present in db or not
      if (createEventDto.isRestricted === true) {
        if (createEventDto.params.userIds) {
          await this.validateUserIds(createEventDto.params.userIds);
        }
        else if (createEventDto.params.cohortIds) {
          await this.validateCohortIds(createEventDto.params.cohortIds)
        }
      }
      createEventDto.createdBy = userId;
      createEventDto.updatedBy = userId;
      if (createEventDto.isRestricted === true) {
        createEventDto.autoEnroll = true;
      }

      //api call for zoom/googlemeet if new or existing event is created by user
      if (createEventDto.eventType === 'online') {
        if (createEventDto.isMeetingNew) {
          const meeting: CreateMeetingDto = {
            meetingType: createEventDto.onlineProvider,
            topic: createEventDto.title,
            type: 2,
            start_time: createEventDto.startDatetime,
            duration: 60,
            timezone: 'Asia/Kolkata',
          }
          const result = await this.meetingsService.createMeeting(meeting);
          if (result) {
            createEventDto.meetingDetails = result;
          }
          else {
            return APIResponse.error(response, apiId, "Internal Server Error", `Event Not Created`, HttpStatus.INTERNAL_SERVER_ERROR);
          }
        }
        // Ensure offline fields are null for online events
        createEventDto.location = null;
        createEventDto.latitude = null;
        createEventDto.longitude = null;
      }
      // Handle offline event
      if (createEventDto.eventType === 'offline') {
        // Ensure online fields are null for offline events
        createEventDto.isMeetingNew = null;
        createEventDto.meetingDetails = null;
        createEventDto.onlineProvider = null;
      }
      const created = await this.eventRespository.save(createEventDto);
      // Create attendees if isRsetricted true and event status is live
      if (created.eventId && createEventDto.isRestricted === true && createEventDto.status == 'live') {
        const attendeesEnrolledResult = await this.CreateAttendeedforRestrictedEvent(createEventDto, created, userId)
        // Check if attendees were successfully registered
        if (attendeesEnrolledResult && attendeesEnrolledResult.length > 0) {
          return APIResponse.success(response, apiId, { event_ID: created.eventId, attendeesEnrolled: true }, HttpStatus.CREATED, 'Event and attendees registered successfully');
        } else {
          return APIResponse.success(response, apiId, { event_ID: created.eventId, attendeesEnrolled: false }, HttpStatus.CREATED, 'Event created but attendees not registered');
        }
      }
      return APIResponse.success(response, apiId, { event_ID: created.eventId, attendeesEnrolled: true }, HttpStatus.OK, 'Event and attendees registered successfully');
    }
    catch (e) {
      const errorMessage = e.message || 'Internal server error';
      return APIResponse.error(response, apiId, "Internal Server Error", errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getEvents(response: Response, requestBody: SearchFilterDto) {
    const apiId = APIID.EVENT_LIST;
    try {
      let finalquery = `SELECT * FROM "Events"`;
      const { filters } = requestBody;
      if (filters && Object.keys(filters).length > 0) {
        finalquery = await this.createSearchQuery(filters, finalquery);
      }
      const result = await this.eventRespository.query(finalquery);
      if (result.length === 0) {
        return APIResponse.error(
          response,
          apiId,
          `No event found`,
          'records not found.',
          HttpStatus.NOT_FOUND
        )
      }
      return APIResponse.success(response, apiId, result, HttpStatus.OK, "Event fetched successfully");
    }
    catch (e) {
      const errorMessage = e.message || 'Internal server error';
      return APIResponse.error(response, apiId, "Internal Server Error", errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getEventByID(eventId: string, response: Response) {
    const apiId = APIID.EVENT_GET;
    try {
      const getEventById = await this.eventRespository.findOne({ where: { eventId } });
      if (!getEventById) {
        return APIResponse.error(
          response,
          apiId,
          `No event found for: ${eventId}`,
          'records not found',
          HttpStatus.NOT_FOUND
        )
      }
      return APIResponse.success(response, apiId, getEventById, HttpStatus.OK, 'Event fetched successfully')

    }
    catch (e) {
      const errorMessage = e.message || 'Internal server error';
      return APIResponse.error(response, apiId, "Internal Server Error", errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateEvent(eventId: string, updateEventDto: UpdateEventDto, userId: string, response: Response) {
    const apiId = APIID.EVENT_UPDATE;
    try {
      const event = await this.eventRespository.findOne({ where: { eventId } })
      if (!event) {
        return APIResponse.error(
          response,
          apiId,
          `No event found for: ${eventId}`,
          'records not found.',
          HttpStatus.NOT_FOUND
        )
      }

      //convert online into offiline 
      if (event.eventType === 'online' && updateEventDto.eventType === 'offline') {
        const today = new Date();
        if (new Date(updateEventDto.startDatetime) <= today) {
          throw new Error('You cannot convert an online event to offline if it is scheduled for a future date.');
        } else if (new Date(event.startDatetime) <= today) {
          throw new Error('You cannot convert an online event to offline if it is scheduled for a future date.');
        }
        // Ensure online fields are null for offline events
        updateEventDto.isMeetingNew = null;
        updateEventDto.meetingDetails = null;
        updateEventDto.onlineProvider = null;
      }
      //convert offline into online
      if (event.eventType === 'offline' && updateEventDto.eventType === 'online') {
        const today = new Date();
        if (new Date(updateEventDto.startDatetime) <= today) {
          throw new Error('You cannot convert an online event to offline if it is scheduled for a future date.');
        } else if (new Date(event.startDatetime) <= today) {
          throw new Error('You cannot convert an online event to offline if it is scheduled for a future date.');
        }
        else {
          //need to call zoom create API
          if (updateEventDto.isMeetingNew) {
            const meeting: CreateMeetingDto = {
              meetingType: updateEventDto.onlineProvider,
              topic: updateEventDto.title || event.title,
              type: 2,
              start_time: updateEventDto.startDatetime || event.startDatetime,
              duration: 60, // need to remove this value
              timezone: 'Asia/Kolkata',
            }
            const result = await this.meetingsService.createMeeting(meeting);
            if (result) {
              updateEventDto.meetingDetails = result;
            }
            else {
              return APIResponse.error(response, apiId, "Internal Server Error", `Event Not Created`, HttpStatus.INTERNAL_SERVER_ERROR);
            }
          }
          // Ensure offline fields are null for online events
          updateEventDto.location = null;
          updateEventDto.latitude = null;
          updateEventDto.longitude = null;
        }
      }

      // if user only update start date or title or somthing which need to chage in create zoom meeting
      // if ((updateEventDto.startDatetime || updateEventDto.title) && event.eventType === 'online') {
      //   // need to call update zoom API
      //   const id = event.meetingDetails.id;
      //   const newUpdateObject = {
      //     meetingType: event.onlineProvider,
      //     topic: updateEventDto.title || event.title,
      //     start_time: updateEventDto.startDatetime || event.startDatetime,
      //   }
      //   //call if meeting is created by my account
      //   const result = await this.meetingsService.updateMeeting(id, newUpdateObject);
      //   if (result.status != 204) {
      //     throw new BadRequestException('Meeting is not updating')
      //   }
      // }

      // convert public event into private event if status is draft
      if (updateEventDto.isRestricted == true && event.isRestricted == false) {
        if (event.status == 'draft') {
          if (updateEventDto.params && Object.keys(updateEventDto.params.length > 0)) {
            if (updateEventDto.params.userIds) {
              await this.validateUserIds(updateEventDto.params.userIds);
            }
            else if (updateEventDto.params.cohortIds) {
              await this.validateCohortIds(updateEventDto.params.cohortIds)
            }
            await this.CreateAttendeedforRestrictedEvent(updateEventDto, event, userId)
          }
        }
        else {
          throw new BadRequestException('You can not update public into private event beacuse event is live');
        }
      }
      // You can update private event again private 
      if (updateEventDto.isRestricted == true && event.isRestricted == true) {
        throw new BadRequestException('You can not update private event as private');
      }

      // Convert private event to public if status is draft
      if (updateEventDto.isRestricted == false && event.isRestricted == true) {
        if (event.status == 'draft') {
          event.params = {};
        }
        else {
          throw new BadRequestException('You can not update private into public event beacuse event is live');
        }
      }

      //if event created as draft and private and now event become live then automatic entry will go in attenddes table of private atendees
      if (event.status == 'draft' && updateEventDto.status == 'live' && event.isRestricted == true) {
        if (event.params && Object.keys(event.params.length > 0)) {
          if (event.params.userIds) {
            await this.CreateAttendeedforRestrictedEvent(event, event, userId)
          }
          else if (event.params.cohortIds) {
            await this.CreateAttendeedforRestrictedEvent(event, event, userId)
          }
        }
      }
      Object.assign(event, updateEventDto);

      //validation pipe for check start date and end date  or only start date
      if ((updateEventDto.startDatetime && updateEventDto.endDatetime) || updateEventDto.startDatetime) {
        new DateValidationPipe().transform(event);
      }
      //validation pipe for if user want to change only end date
      if (updateEventDto.endDatetime) {
        const startDate = new Date(event.startDatetime);
        const endDate = new Date(updateEventDto.endDatetime);
        if (startDate > endDate) {
          throw new BadRequestException('End date should be greater than or equal to start date')
        }
      }

      //validation pipe for registration deadline date
      new DeadlineValidationPipe().transform(event);
      // validation pipe for empty param object
      new ParamsValidationPipe().transform(event);
      event.updatedBy = userId;
      const updated_result = await this.eventRespository.save(event);
      if (!updated_result) {
        throw new BadRequestException('Event update failed');
      }
      APIResponse.success(response, apiId, { id: eventId }, HttpStatus.OK, 'updated Successfully')
    }
    catch (e) {
      const errorMessage = e.message || 'Internal server error';
      return APIResponse.error(response, apiId, "Internal Server Error", errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteEvent(eventId: string, response: Response) {
    const apiId = APIID.EVENT_DELETE;
    try {
      const event_id = await this.eventRespository.findOne({ where: { eventId } })
      if (!event_id) {
        APIResponse.error(
          response,
          apiId,
          `No event found for: ${eventId}`,
          'records not found.',
          HttpStatus.NOT_FOUND
        )
      }
      const deletedEvent = await this.eventRespository.delete({ eventId });
      if (deletedEvent.affected !== 1) {
        throw new BadRequestException('Event not deleted');
      }

      return APIResponse.success(
        response,
        apiId,
        { status: `Event with ID ${eventId} deleted successfully.` },
        HttpStatus.OK,
        'Deleted successfully',
      )
    }
    catch (e) {
      const errorMessage = e.message || 'Internal server error';
      return APIResponse.error(response, apiId, "Internal Server Error", errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createSearchQuery(filters, finalquery) {
    let whereClause = false;
    if (filters.title && filters.title !== "") {
      finalquery += ` WHERE "title" LIKE '%${filters.title}%'`;
      whereClause = true;
    }
    if (filters.eventType && filters.eventType.length > 0) {
      let eventTypeConditions = [];
      filters.eventType.forEach((eventType) => {
        eventTypeConditions.push(`"eventType" = '${eventType}'`);
      });
      finalquery += whereClause ? ` AND (${eventTypeConditions.join(' OR ')})` : ` WHERE (${eventTypeConditions.join(' OR ')})`;
      whereClause = true;
    }
    if (filters.status && filters.status.length > 0) {
      let statusConditions = [];
      filters.status.forEach((status) => {
        statusConditions.push(`"status" = '${status}'`);
      });
      finalquery += whereClause ? ` AND (${statusConditions.join(' OR ')})` : ` WHERE (${statusConditions.join(' OR ')})`;
      whereClause = true;
    }
    if (filters.startDate && filters.endDate) {
      finalquery += whereClause ? ` AND "startDatetime" >= TIMESTAMP '${filters.startDate}' AND "endDatetime" <= '${filters.endDate}'` : ` WHERE "startDatetime" >= '${filters.startDate}' AND "endDatetime" <= '${filters.endDate}'`;
    } else if (filters.startDate) {
      finalquery += whereClause ? ` AND "startDatetime" >= TIMESTAMP '${filters.startDate}'` : ` WHERE "startDatetime" >= TIMESTAMP '${filters.startDate}'`;
    } else if (filters.endDate) {
      finalquery += whereClause ? ` AND "endDatetime" <=  TIMESTAMP '${filters.endDate}'` : ` WHERE "endDatetime" TIMESTAMP <= '${filters.endDate}'`;
    }
    // if (filters.createdBy && filters.createdBy !== "") {
    //   finalquery += whereClause ? ` AND "createdBy" LIKE '%${filters.createdBy}%'` : ` WHERE "createdBy" = '${filters.createdBy}'`;
    // }
    return finalquery;
  }

  // check userids present in user table or not
  async validateUserIds(userIds: string[]) {
    const queryBuilder = this.usersRepo.createQueryBuilder('Users')
      .select('Users.userId', 'userId')
      .where('Users.userId IN (:...userIds)', { userIds });
    const users = await queryBuilder.getRawMany();
    const existingUserIds = users.map(user => user.userId);
    const missingUserIds = userIds.filter(userId => !existingUserIds.includes(userId));
    if (missingUserIds.length > 0) {
      throw new BadRequestException(`The following user IDs are not present: ${missingUserIds.join(', ')}`);
    }
  }

  // check cohortids present in cohort table or not
  async validateCohortIds(cohortIds: string[]) {
    const queryBuilder = this.cohortRepo.createQueryBuilder('Cohort')
      .select('Cohort.cohortId', 'cohortId')
      .where('Cohort.cohortId IN (:...cohortIds)', { cohortIds });
    const cohorts = await queryBuilder.getRawMany();
    const existingCohortIds = cohorts.map(cohort => cohort.cohortId);
    const missingCohortIds = cohortIds.filter(cohortId => !existingCohortIds.includes(cohortId));
    if (missingCohortIds.length > 0) {
      throw new BadRequestException(`The following cohort IDs are not present: ${missingCohortIds.join(', ')}`);
    }
  }

  async CreateAttendeedforRestrictedEvent(createEventDto, created, userId) {
    const attendeedDto: EventAttendeesDTO = {
      eventId: created.eventId,
      enrolledBy: userId,
      status: 'published'
    }
    const cohortsIdsOruserIds = createEventDto?.params; //{ cohortIds: [ 'eff008a8-2573-466d-b877-fddf6a4fc13e' ] }
    const cohortIds = cohortsIdsOruserIds.cohortIds || [];
    const userIds = cohortsIdsOruserIds.userIds || [];
    if (cohortIds?.length > 0) {
      const userIds: string[] = [];
      const queryBuilder = this.cohortMemberRepo.createQueryBuilder('CohortMembers')
        .select('CohortMembers.userId', 'userId')
        .where('CohortMembers.cohortId IN (:...cohortIds)', { cohortIds });
      const cohortMembers = await queryBuilder.getRawMany();
      for (const member of cohortMembers) {
        userIds.push(member.userId);
      }
      if (userIds.length > 0) {
        try {
          return await this.attendeesService.saveattendessRecord(attendeedDto, userIds);
        } catch (e) {
          return e
        }
      }
    }
    else if (userIds?.length > 0) {
      try {
        return await this.attendeesService.saveattendessRecord(attendeedDto, userIds);
      } catch (e) {
        console.error(`Failed to create event attendees: ${e.message || e}`);
        throw e
      }
    }
  }
}