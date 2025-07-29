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
import { AttendeesStatus } from 'src/common/utils/types';
import { KafkaService } from 'src/kafka/kafka.service';
import { LoggerWinston } from 'src/common/logger/logger.util';

@Injectable()
export class AttendeesService {
  constructor(
    @InjectRepository(EventAttendees)
    private readonly eventAttendeesRepository: Repository<EventAttendees>,
    private readonly kafkaService: KafkaService,
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
        this.publishAttendeeEvent(
          'created',
          result[0]?.eventAttendeesId,
          result[0],
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
        this.publishAttendeeEvent(
          'created',
          result[0]?.eventAttendeesId,
          result[0],
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
      joinedLeftHistory: [],
      duration: 0,
      isAttended: false,
      status: eventAttendeesDTO.status,
      enrolledBy: eventAttendeesDTO.enrolledBy,
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
        this.publishAttendeeEvent('deleted', eventId, { eventId });
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
      this.publishAttendeeEvent(
        'updated',
        updated_result.eventAttendeesId,
        updated_result,
      );
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

  private async publishAttendeeEvent(
    eventType: 'created' | 'updated' | 'deleted',
    attendeeId: string,
    attendeeData: any,
  ): Promise<void> {
    const apiId = `api.attendees.${eventType}`;
    try {
      await this.kafkaService.publishTrackingEvent(
        eventType,
        attendeeData,
        attendeeId,
      );
      LoggerWinston.log(
        `Attendee ${eventType} event published for attendee ${attendeeId}`,
        apiId,
      );
    } catch (error) {
      LoggerWinston.error(
        `Failed to publish attendee ${eventType} event to Kafka for attendee ${attendeeId}`,
        error.stack,
        apiId,
      );
    }
  }
}
