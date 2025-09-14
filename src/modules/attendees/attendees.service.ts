import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { EventAttendeesDTO } from './dto/EventAttendance.dto';
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { EventAttendees } from './entity/attendees.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchAttendeesDto } from './dto/searchAttendees.dto';
import { UpdateAttendeesDto } from './dto/updateAttendees.dto';
import { AttendeesStatus, EventStatus } from 'src/common/utils/types';
import { EnrollmentDto } from './dto/provider-enrollment.dto';
import { DeleteEnrollmentDto } from './dto/delete-enrollment.dto';
import { OnlineMeetingAdapter } from 'src/online-meeting-adapters/onlineMeeting.adapter';
import { MeetingType } from 'src/common/utils/types';
import { EventRepetition } from '../event/entities/eventRepetition.entity';
import { Events } from '../event/entities/event.entity';
import { EventDetail } from '../event/entities/eventDetail.entity';
import { Search_Event_AttendeesDto } from './dto/search-attendees.dto';

@Injectable()
export class AttendeesService {
  constructor(
    @InjectRepository(Events)
    private readonly eventRepository: Repository<Events>,
    @InjectRepository(EventAttendees)
    private readonly eventAttendeesRepository: Repository<EventAttendees>,
    @InjectRepository(EventRepetition)
    private readonly eventRepetitionRepository: Repository<EventRepetition>,
    private readonly onlineMeetingAdapter: OnlineMeetingAdapter,
  ) {}

  async createAttendees(
    eventAttendeesDTO: EventAttendeesDTO,
    response: Response,
    userId: string,
    userIds?: string[],
  ): Promise<Response> {
    const apiId = 'create.event.attendees';
    try {
      if (userIds && userIds.length > 0) {
        const result = await this.saveattendessRecord(
          eventAttendeesDTO,
          userIds,
        );
      } else {
        // const attendees = await this.eventAttendeesRepo.find({
        //   where: { userId, eventId: eventAttendeesDTO.eventId },
        // });
        const attendees = [];
        if (attendees.length > 0) {
          throw new BadRequestException(
            `You have already registered for this event: ${eventAttendeesDTO.eventId}`,
          );
        }
        const userIdArray = [userId];
        const result = await this.saveattendessRecord(
          eventAttendeesDTO,
          userIdArray,
        );
        return response
          .status(HttpStatus.CREATED)
          .send(
            APIResponse.success(
              apiId,
              { attendeesId: result[0]?.eventAttendeesId },
              'Created',
            ),
          );
      }
    } catch (e) {
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(
          APIResponse.error(
            apiId,
            'Something went wrong',
            JSON.stringify(e),
            'INTERNAL_SERVER_ERROR',
          ),
        );
    }
  }

  async saveattendessRecord(
    eventAttendeesDTO: EventAttendeesDTO,
    userIds: string[],
  ) {
    const eventAttendees = userIds.map((userId) => ({
      userId: userId,
      eventId: eventAttendeesDTO.eventId,
      eventRepetitionId: eventAttendeesDTO.eventRepetitionId,
      registrantId: eventAttendeesDTO.registrantId,
      joinedLeftHistory: [],
      duration: 0,
      isAttended: false,
      status: eventAttendeesDTO.status,
      enrolledBy: eventAttendeesDTO.enrolledBy,
      params: eventAttendeesDTO.params || {},
    }));

    const results = await this.eventAttendeesRepository.save(eventAttendees);
    return results;
  }

  async getAttendees(
    searchAttendeesDto: SearchAttendeesDto,
    response: Response,
  ) {
    const apiId = 'api.get.Attendees';
    const { userId, eventId } = searchAttendeesDto;
    try {
      if (userId && eventId) {
        // const attendees = await this.eventAttendeesRepo.find({
        //   where: { userId, eventId },
        // });
        const attendees = [];
        if (!attendees || attendees.length === 0) {
          return response
            .status(HttpStatus.NOT_FOUND)
            .send(
              APIResponse.error(
                apiId,
                `User : ${userId}: not regitered for this event : ${eventId} `,
                'No attendees found.',
                'NOT_FOUND',
              ),
            );
        }
        return response
          .status(HttpStatus.OK)
          .send(APIResponse.success(apiId, attendees, 'OK'));
      } else if (userId) {
        const query = `SELECT * FROM "Users" WHERE "userId"='${userId}'`;
        const user = await this.eventAttendeesRepository.query(query);
        if (user.length === 0) {
          return response
            .status(HttpStatus.NOT_FOUND)
            .send(
              APIResponse.error(
                apiId,
                'User not found',
                'User Not Exist.',
                'NOT_FOUND',
              ),
            );
        }
        const attendees = await this.eventAttendeesRepository.find({
          where: { userId: userId },
        });
        if (!attendees || attendees.length === 0) {
          return response
            .status(HttpStatus.NOT_FOUND)
            .send(
              APIResponse.error(
                apiId,
                `No attendees found for this user Id : ${userId}`,
                'No attendees found.',
                'NOT_FOUND',
              ),
            );
        }
        return response
          .status(HttpStatus.OK)
          .send(APIResponse.success(apiId, { attendees, ...user[0] }, 'OK'));
      } else if (eventId) {
        const eventID = eventId;
        const attendees = [];
        // const attendees = await this.eventAttendeesRepo.find({
        //   where: { eventId: eventID },
        // });
        if (!attendees || attendees.length === 0) {
          return response
            .status(HttpStatus.NOT_FOUND)
            .send(
              APIResponse.error(
                apiId,
                `No attendees found for this event Id : ${eventId}`,
                'No records found.',
                'NOT_FOUND',
              ),
            );
        }
        return response
          .status(HttpStatus.OK)
          .send(APIResponse.success(apiId, attendees, 'OK'));
      }
    } catch (e) {
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(
          APIResponse.error(
            apiId,
            'Something went wrong',
            JSON.stringify(e),
            'INTERNAL_SERVER_ERROR',
          ),
        );
    }
  }

  async deleteAttendees(
    searchAttendeesDto: SearchAttendeesDto,
    response: Response,
  ) {
    const apiId = 'api.delete.attendees';
    const { userId, eventId } = searchAttendeesDto;
    try {
      if (eventId && !userId) {
        const deleteAttendees = await this.deleteEventAttendees(eventId);
        return response.status(HttpStatus.OK).send(
          APIResponse.success(
            apiId,
            {
              status: `Event Attendees for event ID ${eventId} deleted successfully.${deleteAttendees.affected} rows affected`,
            },
            'OK',
          ),
        );
      } else if (userId && !eventId) {
        const deleteAttendees = await this.deleteUserAttendees(userId);
        return response.status(HttpStatus.OK).send(
          APIResponse.success(
            apiId,
            {
              status: `Event Attendees for user ID ${userId} deleted successfully.${deleteAttendees.affected} rows affected`,
            },
            'OK',
          ),
        );
      } else if (userId && eventId) {
        throw new NotImplementedException();
        // const deletedAttendees = await this.eventAttendeesRepo.delete({
        //   eventId,
        //   userId,
        // });
        // if (deletedAttendees.affected != 1) {
        //   throw new BadRequestException('Not deleted');
        // }
        // return response.status(HttpStatus.OK).send(
        //   APIResponse.success(
        //     apiId,
        //     {
        //       status: `Event Attendees for user and eventId deleted successfully.`,
        //     },
        //     'OK',
        //   ),
        // );
      }
    } catch (e) {
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(
          APIResponse.error(
            apiId,
            'Something went wrong',
            JSON.stringify(e),
            'INTERNAL_SERVER_ERROR',
          ),
        );
    }
  }

  public async deleteEventAttendees(eventId: string) {
    try {
      const deletedAttendees = await this.eventAttendeesRepository
        .createQueryBuilder()
        .delete()
        .from(EventAttendees)
        .where('"eventId" = :eventId', { eventId })
        .execute();
      return deletedAttendees;
    } catch (e) {
      throw new BadRequestException('Event not deleted', e);
    }
  }

  public async deleteUserAttendees(userId: string) {
    try {
      const deletedAttendees = await this.eventAttendeesRepository
        .createQueryBuilder()
        .delete()
        .from(EventAttendees)
        .where('"userId" = :userId', { userId })
        .execute();
      return deletedAttendees;
    } catch (e) {
      throw new BadRequestException('users not deleted', e);
    }
  }

  async updateAttendees(
    updateAttendeesDto: UpdateAttendeesDto,
    response: Response,
  ) {
    const apiId = 'api.update.attendees';
    try {
      const attendees = null;
      // await this.eventAttendeesRepo.findOne({
      //   where: {
      //     eventId: updateAttendeesDto.eventId,
      //     userId: updateAttendeesDto.userId,
      //   },
      // });
      if (!attendees) {
        return response
          .status(HttpStatus.NOT_FOUND)
          .send(
            APIResponse.error(
              apiId,
              `No record found for this: ${updateAttendeesDto.eventId} and ${updateAttendeesDto.userId}`,
              'records not found.',
              'NOT_FOUND',
            ),
          );
      }
      if (
        updateAttendeesDto.joinedLeftHistory &&
        Object.keys(updateAttendeesDto.joinedLeftHistory).length > 0
      ) {
        updateAttendeesDto.joinedLeftHistory =
          attendees.joinedLeftHistory.concat(
            updateAttendeesDto.joinedLeftHistory,
          );
      }
      Object.assign(attendees, updateAttendeesDto);
      const updated_result =
        await this.eventAttendeesRepository.save(attendees);
      if (!updated_result) {
        throw new BadRequestException('Attendees updation failed');
      }
      return response
        .status(HttpStatus.OK)
        .send(APIResponse.success(apiId, updateAttendeesDto, 'updated'));
    } catch (e) {
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(
          APIResponse.error(
            apiId,
            'Something went wrong',
            JSON.stringify(e),
            'INTERNAL_SERVER_ERROR',
          ),
        );
    }
  }

  createEventAttendeesRecord(
    userId: string,
    eventId: string,
    eventRepetitionId: string,
    creatorOrUpdaterId: string,
  ) {
    const eventAttendees = new EventAttendees();
    eventAttendees.userId = userId;
    eventAttendees.eventId = eventId;
    eventAttendees.eventRepetitionId = eventRepetitionId;
    eventAttendees.enrolledAt = new Date();
    eventAttendees.updatedAt = new Date();
    eventAttendees.enrolledBy = creatorOrUpdaterId;
    eventAttendees.updatedBy = creatorOrUpdaterId;
    eventAttendees.isAttended = false;
    eventAttendees.status = AttendeesStatus.active;

    return eventAttendees;
  }

  async createAttendeesForRecurringEvents(
    userIds: string[],
    eventId: string,
    eventRepetitionIds: [],
    creatorOrUpdaterId: string,
  ) {
    // TODO: check max attendees
    // This method creates attendees when attendees are passed during creating event in attendees array and autoEnroll and isRestricted is true
    // All the attendees passed will be added to all recurring events
    // if there are 5 recurring events and 5 attendees then total 5*5 that is 25 entries will be added to the database
    try {
      if (!userIds?.length) return;
      const promises = [];
      eventRepetitionIds.forEach(({ eventRepetitionId }) => {
        const attendeesRecords = userIds.map((userId) =>
          // attendeesRecords.push(
          this.createEventAttendeesRecord(
            userId,
            eventId,
            eventRepetitionId,
            creatorOrUpdaterId,
            // ),
          ),
        );
        promises.push(this.eventAttendeesRepository.insert(attendeesRecords));
      });
      const prm = await Promise.allSettled(promises);
      prm.forEach((result) => {
        if (result.status !== 'fulfilled') {
          throw result.reason;
        }
      });
    } catch (e) {
      throw e;
    }
  }

  async createAttendeesForEvents(
    userIds: string[],
    eventId: string,
    creatorId: string,
  ) {
    // This method creates attendees when attendees are passed during creating event in attendees array and autoEnroll and isRestricted is true
    // All the attendees passed will be added to the event
    try {
      if (!userIds?.length) return;
      const attendeesRecords = userIds.map((userId) =>
        this.createEventAttendeesRecord(userId, eventId, null, creatorId),
      );
      await this.eventAttendeesRepository.insert(attendeesRecords);
    } catch (e) {
      throw e;
    }
  }

  async getAttendeeByEventAndUser(
    eventId: string,
    eventRepetitionId: string,
    userId: string,
    response: Response,
  ): Promise<Response> {
    const apiId = 'api.get.attendee';
    try {
      if (eventId !==undefined && eventRepetitionId === undefined) {
        const eventRepetition = await this.eventRepetitionRepository.findOne({
          where: { eventId },
        });

        if (!eventRepetition) {
          throw new BadRequestException(
            `Event repetition not found for event ${eventId}`,
          );
        }

        eventRepetitionId = eventRepetition.eventRepetitionId;
      }
      const attendee = await this.eventAttendeesRepository.findOne({
        where: { eventRepetitionId, userId },
      });

      if (!attendee) {
        return response
          .status(HttpStatus.NOT_FOUND)
          .send(
            APIResponse.error(
              apiId,
              `No attendee found for eventRepetitionId: ${eventRepetitionId} and userId: ${userId}`,
              'Attendee not found',
              'NOT_FOUND',
            ),
          );
      }

      return response
        .status(HttpStatus.OK)
        .send(APIResponse.success(apiId, attendee, 'Attendee details retrieved successfully'));
    } catch (e) {
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(
          APIResponse.error(
            apiId,
            'Something went wrong',
            JSON.stringify(e),
            'INTERNAL_SERVER_ERROR',
          ),
        );
    }
  }

  async enrollUserToMeeting(
    enrollmentDto: EnrollmentDto,
    response: Response,
    enrolledBy: string,
  ): Promise<Response> {
    const apiId = 'enroll.user';
    try {
      const { eventId, userId, userEmail, firstName, lastName } = enrollmentDto;

      let eventRepetitionId = enrollmentDto.eventRepetitionId;
      // if both eventRepetitionId and eventId are not passed, throw an error
      if (enrollmentDto.eventRepetitionId === undefined && eventId === undefined) {
        throw new BadRequestException(
          `Either eventRepetitionId or eventId must be passed`,
        );
      }

      if (eventId !==undefined && enrollmentDto.eventRepetitionId === undefined) {
       
        const event = await this.eventRepository.findOne({
          where: { eventId: eventId },
          relations: ['eventDetail', 'eventRepetitions'],
        });

        if (!event || event.eventDetail.status === EventStatus.archived) {
          throw new BadRequestException(
            `Event not found for event ${eventId}`,
          );
        }
        const eventRepetition = await this.eventRepetitionRepository.findOne({
          where: { eventId },
        });

        if (!event.eventRepetitions || event.eventRepetitions.length === 0) {
          throw new BadRequestException(
            `Event repetition not found for event ${eventId}`,
          );
        }

        eventRepetitionId = eventRepetition.eventRepetitionId;
      }
      // Check if user is already enrolled for this event
      const existingAttendee = await this.eventAttendeesRepository.findOne({
        where: { userId, eventRepetitionId },
      });

      if (existingAttendee) {
        throw new BadRequestException(
          `User ${userId} is already enrolled for event ${eventRepetitionId}`,
        );
      }

      //get meeting id from eventId from onlineDetails (get first available event repetition)
      const eventRepetition = await this.eventRepetitionRepository.findOne({
        where: { eventRepetitionId },
      });

      if (!eventRepetition) {
        throw new BadRequestException(
          `Event repetition not found for event ${eventRepetitionId}`,
        );
      }

      if (
        !eventRepetition.onlineDetails ||
        !(eventRepetition.onlineDetails as any).id
      ) {
        throw new BadRequestException(
          `No online meeting details found for event ${eventRepetitionId}`,
        );
      }

      const meetingId = (eventRepetition.onlineDetails as any).id;

      // Get provider from event details or default to 'Zoom'
      const provider =
        (eventRepetition.onlineDetails as any).provider || 'Zoom';

      // Get the appropriate adapter for the provider
      const adapter = this.onlineMeetingAdapter.getAdapter();

      // Determine meeting type (default to meeting, can be enhanced based on provider)
      const meetingType =
        (eventRepetition.onlineDetails as any).meetingType ||
        MeetingType.meeting;

      // Prepare attendee data for provider API
      const attendeeData = {
        email: userEmail,
        first_name: firstName,
        last_name: lastName,
      };

      // Enroll user to provider meeting
      const providerResponse = await adapter.addRegistrantToMeeting(
        meetingId,
        attendeeData,
        meetingType,
      );

      if (!providerResponse) {
        throw new BadRequestException(
          `Failed to enroll user to ${provider} meeting`,
        );
      }

      // Create attendee record in database
      const eventAttendeesDTO: EventAttendeesDTO = {
        eventRepetitionId: eventRepetition.eventRepetitionId,
        userId,
        eventId: eventRepetition.eventId,
        status: 'published',
        enrolledBy,
        enrolledAt: new Date(),
        registrantId: providerResponse.registrant_id,
        params: {
          [provider.toLowerCase()]: {
            registrant_id: providerResponse.registrant_id,
            join_url: providerResponse.join_url,
            meeting_id: meetingId,
            provider: provider,
          },
        },
      };

      const attendeeRecord = await this.saveattendessRecord(eventAttendeesDTO, [
        userId,
      ]);

      return response.status(HttpStatus.CREATED).send(
        APIResponse.success(
          apiId,
          {
            attendeesId: attendeeRecord[0]?.eventAttendeesId,
            providerRegistrantId: providerResponse.registrant_id,
            joinUrl: providerResponse.join_url,
            provider: provider,
          },
          `User enrolled to ${provider} meeting successfully`,
        ),
      );
    } catch (e) {
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(
          APIResponse.error(
            apiId,
            'Failed to enroll user to meeting',
            JSON.stringify(e),
            'INTERNAL_SERVER_ERROR',
          ),
        );
    }
  }

  async deleteEnrollment(
    deleteEnrollmentDto: DeleteEnrollmentDto,
    response: Response,
  ): Promise<Response> {
    const apiId = 'delete.enrollment';
    try {
      const { userId } = deleteEnrollmentDto;

      let eventRepetitionId = deleteEnrollmentDto.eventRepetitionId;
      // if both eventRepetitionId and eventId are not passed, throw an error
      if (deleteEnrollmentDto.eventRepetitionId === undefined && deleteEnrollmentDto.eventId === undefined) {
        throw new BadRequestException(
          `Either eventRepetitionId or eventId must be passed`,
        );
      }

      if (deleteEnrollmentDto.eventId !==undefined && deleteEnrollmentDto.eventRepetitionId === undefined) {
       
        const event = await this.eventRepository.findOne({
          where: { eventId: deleteEnrollmentDto.eventId },
          relations: ['eventDetail', 'eventRepetitions'],
        });

        if (!event || event.eventDetail?.status === EventStatus.archived) {
          throw new BadRequestException(
            `Event not found for event ${deleteEnrollmentDto.eventId}`,
          );
        }

        if (!event.eventRepetitions || event.eventRepetitions.length === 0) {
          throw new BadRequestException(
            `Event repetition not found for event ${deleteEnrollmentDto.eventId}`,
          );
        }

        eventRepetitionId = event.eventRepetitions[0].eventRepetitionId;
      }
      // Find the enrollment record
      const enrollment = await this.eventAttendeesRepository.findOne({
        where: { userId, eventRepetitionId },
      });

      if (!enrollment) {
        return response
          .status(HttpStatus.NOT_FOUND)
          .send(
            APIResponse.error(
              apiId,
              `No enrollment found for user ${userId} in event ${eventRepetitionId}`,
              'Enrollment not found',
              'NOT_FOUND',
            ),
          );
      }

      // Get event repetition details to find meeting information
      const eventRepetition = await this.eventRepetitionRepository.findOne({
        where: { eventRepetitionId },
      });

      if (!eventRepetition) {
        return response
          .status(HttpStatus.NOT_FOUND)
          .send(
            APIResponse.error(
              apiId,
              `Event repetition not found for ${eventRepetitionId}`,
              'Event repetition not found',
              'NOT_FOUND',
            ),
          );
      }

      // Check if there's a registrant ID and online meeting details
      if (enrollment.registrantId && eventRepetition.onlineDetails) {
        const meetingId = (eventRepetition.onlineDetails as any).id;
        const provider = (eventRepetition.onlineDetails as any).provider || 'Zoom';
        const meetingType = (eventRepetition.onlineDetails as any).meetingType || MeetingType.meeting;

        if (meetingId) {
          try {
            // Get the appropriate adapter for the provider
            const adapter = this.onlineMeetingAdapter.getAdapter();

            // Remove registrant from provider meeting
            await adapter.removeRegistrantFromMeeting(
              meetingId,
              enrollment.registrantId,
              meetingType,
            );
          } catch (providerError) {
            throw new BadRequestException(
              `Failed to remove registrant from ${provider} meeting:`,
              providerError,
            );
          }
        }
      }

      // Delete the enrollment record from database
      const deleteResult = await this.eventAttendeesRepository.delete({
        userId,
        eventRepetitionId,
      });

      if (deleteResult.affected === 0) {
        return response
          .status(HttpStatus.NOT_FOUND)
          .send(
            APIResponse.error(
              apiId,
              `Failed to delete enrollment for user ${userId} in event ${eventRepetitionId}`,
              'Enrollment deletion failed',
              'NOT_FOUND',
            ),
          );
      }

      return response.status(HttpStatus.OK).send(
        APIResponse.success(
          apiId,
          {
            deleted: true,
            userId,
            eventRepetitionId,
            registrantId: enrollment.registrantId,
          },
          'Enrollment deleted successfully',
        ),
      );
    } catch (e) {
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(
          APIResponse.error(
            apiId,
            'Failed to delete enrollment',
            JSON.stringify(e),
            'INTERNAL_SERVER_ERROR',
          ),
        );
    }
  }

  async searchAttendees(
    searchAttendeesDto: Search_Event_AttendeesDto,
    response: Response,
  ) {
    const apiId = 'api.search.attendees';
    const { 
      userIds, 
      eventIds, 
      eventRepetitionId, 
      offset = 0, 
      limit = 10 
    } = searchAttendeesDto;

    try {
      // Validate that at least one filter is provided
      if (!userIds?.length && !eventIds?.length && !eventRepetitionId) {
        return response
          .status(HttpStatus.BAD_REQUEST)
          .send(
            APIResponse.error(
              apiId,
              'At least one filter (userIds, eventIds, or eventRepetitionId) must be provided',
              'Invalid request parameters',
              'BAD_REQUEST',
            ),
          );
      }

      // Use offset directly for pagination
      const skip = offset;

      // Use raw query to get attendee details and recordings only
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      // Build WHERE conditions
      if (userIds?.length && userIds.length > 0) {
        whereConditions.push(`ea."userId" = ANY($${paramIndex})`);
        queryParams.push(userIds);
        paramIndex++;
      }

      if (eventIds?.length && eventIds.length > 0) {
        whereConditions.push(`ea."eventId" = ANY($${paramIndex})`);
        queryParams.push(eventIds);
        paramIndex++;
      }

      if (eventRepetitionId) {
        whereConditions.push(`ea."eventRepetitionId" = $${paramIndex}`);
        queryParams.push(eventRepetitionId);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM "EventAttendees" ea
        ${whereClause}
      `;

      const countResult = await this.eventAttendeesRepository.query(countQuery, queryParams);
      const totalCount = parseInt(countResult[0].total);

      // Main query - select only attendee details and recordings
      const mainQuery = `
        SELECT 
          ea.*,
          ed.recordings
        FROM "EventAttendees" ea
        LEFT JOIN "Events" e ON e."eventId" = ea."eventId"
        LEFT JOIN "EventDetails" ed ON ed."eventDetailId" = e."eventDetailId"
        ${whereClause}
        ORDER BY ea."enrolledAt" DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, skip);

      const attendees = await this.eventAttendeesRepository.query(mainQuery, queryParams);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);
      const currentPage = Math.floor(offset / limit) + 1;
      const hasNextPage = offset + limit < totalCount;
      const hasPreviousPage = offset > 0;

      const paginationMetadata = {
        offset,
        currentPage,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPreviousPage,
      };

      // Determine search type and generate appropriate response
      let searchType = 'combined_filters';
      let message = `Found ${attendees.length} attendees matching the search criteria`;
      let notFoundMessage = 'No attendees found matching the provided criteria';

      // Determine search type based on filters used
      if (userIds?.length && !eventIds?.length && !eventRepetitionId) {
        searchType = 'user_events';
        message = `Found ${attendees.length} events for ${userIds.length} user(s)`;
        notFoundMessage = `No events found for the specified user(s)`;
      } else if (eventIds?.length && !userIds?.length && !eventRepetitionId) {
        searchType = 'event_attendees';
        message = `Found ${attendees.length} attendees for ${eventIds.length} event(s)`;
        notFoundMessage = `No attendees found for the specified event(s)`;
      } else if (eventRepetitionId && !userIds?.length && !eventIds?.length) {
        searchType = 'event_repetition_attendees';
        message = `Found ${attendees.length} attendees for event repetition ${eventRepetitionId}`;
        notFoundMessage = `No attendees found for event repetition ${eventRepetitionId}`;
      }

      // Handle no results found
      if (attendees.length === 0) {
        return response
          .status(HttpStatus.NOT_FOUND)
          .send(
            APIResponse.error(
              apiId,
              notFoundMessage,
              'No attendees match the search criteria',
              'NOT_FOUND',
            ),
          );
      }

      // Return successful response
      return response
        .status(HttpStatus.OK)
        .send(
          APIResponse.success(
            apiId,
            {
              attendees,
              pagination: paginationMetadata,
              searchType,
              message,
              filters: {
                userIds: userIds?.length ? userIds : null,
                eventIds: eventIds?.length ? eventIds : null,
                eventRepetitionId: eventRepetitionId || null,
              },
            },
            'Attendees retrieved successfully',
          ),
        );
    } catch (e) {
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(
          APIResponse.error(
            apiId,
            'Failed to search attendees',
            JSON.stringify(e),
            'INTERNAL_SERVER_ERROR',
          ),
        );
    }
  }
}
