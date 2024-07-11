import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { EventAttendeesDTO } from './dto/EventAttendance.dto';
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { EventAttendees } from './entity/attendees.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchAttendeesDto } from './dto/searchAttendees.dto';
import { UpdateAttendeesDto } from './dto/updateAttendees.dto';
import { APIID } from 'src/common/utils/api-id.config';

@Injectable()
export class AttendeesService {
    constructor(
        @InjectRepository(EventAttendees)
        private readonly eventAttendeesRepo: Repository<EventAttendees>
    ) { }

    async createSingleAttendees(eventAttendeesDTO: EventAttendeesDTO, response: Response, userId: string) {
        const apiId = APIID.ATTENDEES_CREATE;
        try {
            const attendees = await this.eventAttendeesRepo.find({ where: { userId, eventId: eventAttendeesDTO.eventId } });
            if (attendees.length > 0) {
                throw new BadRequestException(`You have already registered for this event: ${eventAttendeesDTO.eventId}`)
            }
            const userIdArray = [userId];
            const result = await this.saveattendessRecord(eventAttendeesDTO, userIdArray);
            return APIResponse.success(response, apiId, { attendeesId: result[0]?.eventAttendeesId }, HttpStatus.CREATED, 'Attendees Created Succesfully')
        }
        catch (e) {
            const errorMessage = e.message || 'Internal server error';
            return APIResponse.error(response, apiId, "Internal Server Error", errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async saveattendessRecord(eventAttendeesDTO: EventAttendeesDTO, userIds: string[]) {
        try {
            const eventAttendees = userIds.map(userId => ({
                userId: userId,
                eventId: eventAttendeesDTO.eventId,
                joinedLeftHistory: [],
                duration: 0,
                isAttended: false,
                status: eventAttendeesDTO.status,
                enrolledBy: eventAttendeesDTO.enrolledBy
            }));

            const results = await this.eventAttendeesRepo.save(eventAttendees);
            return results;
        }
        catch (e) {
            return e;
        }
    }

    async getAttendees(searchAttendeesDto: SearchAttendeesDto, response: Response) {
        const apiId = APIID.ATTENDEES_LIST;
        const { userId, eventId } = searchAttendeesDto;
        try {
            if (userId && eventId) {
                const attendees = await this.eventAttendeesRepo.find({ where: { userId, eventId } });
                if (!attendees || attendees.length === 0) {
                    return APIResponse.error(response, apiId, `User : ${userId}: not regitered for this event : ${eventId} `, 'No attendees found.', HttpStatus.NOT_FOUND)
                }
                return APIResponse.success(response, apiId, attendees, HttpStatus.OK, 'OK')
            }
            else if (userId) {
                const query = `SELECT * FROM "Users" WHERE "userId"='${userId}'`;
                const user = await this.eventAttendeesRepo.query(query);
                if (user.length === 0) {
                    return APIResponse.error(response, apiId, 'User not found', 'User Not Exist.', HttpStatus.NOT_FOUND);
                }
                const attendees = await this.eventAttendeesRepo.find({ where: { userId: userId } });
                if (!attendees || attendees.length === 0) {
                    return APIResponse.error(response, apiId, `No attendees found for this user Id : ${userId}`, 'No attendees found.', HttpStatus.NOT_FOUND);
                }
                return APIResponse.success(response, apiId, { attendees, ...user[0] }, HttpStatus.OK, 'OK');
            }
            else if (eventId) {
                const eventID = eventId;
                const attendees = await this.eventAttendeesRepo.find({ where: { eventId: eventID } });
                if (!attendees || attendees.length === 0) {
                    return APIResponse.error(
                        response,
                        apiId,
                        `No attendees found for this event Id : ${eventId}`,
                        'No records found.',
                        HttpStatus.NOT_FOUND,
                    )
                }
                return APIResponse.success(response, apiId, attendees, HttpStatus.OK, 'OK')
            }
        }
        catch (e) {
            const errorMessage = e.message || 'Internal server error';
            return APIResponse.error(response, apiId, "Internal Server Error", errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async deleteAttendees(searchAttendeesDto: SearchAttendeesDto, response: Response) {
        const apiId = APIID.ATTENDEES_DELETE;
        const { userId, eventId } = searchAttendeesDto
        try {
            if (eventId && !userId) {
                const deleteAttendees = await this.deleteEventAttendees(eventId);
                return APIResponse.success(
                    response,
                    apiId,
                    { status: `Event Attendees for event ID ${eventId} deleted successfully.${deleteAttendees.affected} rows affected` },
                    HttpStatus.OK,
                    'deleted successfully',
                )
            }
            else if (userId && !eventId) {
                const deleteAttendees = await this.deleteUserAttendees(userId);
                return APIResponse.success(
                    response,
                    apiId,
                    {
                        status: `Event Attendees for user ID ${userId} deleted successfully.${deleteAttendees.affected} rows affected`
                    },
                    HttpStatus.OK,
                    'deleted successfully',
                );
            }
            else if (userId && eventId) {
                const deletedAttendees = await this.eventAttendeesRepo.delete({ eventId, userId });
                if (deletedAttendees.affected != 1) {
                    throw new BadRequestException('Not deleted');
                }
                return APIResponse.success(
                    response,
                    apiId,
                    { status: `Event Attendees deleted successfully.` },
                    HttpStatus.OK,
                    'deleted successfully',
                )
            }
        }
        catch (e) {
            const errorMessage = e.message || 'Internal server error';
            return APIResponse.error(response, apiId, "Internal Server Error", errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public async deleteEventAttendees(eventId: string) {
        try {
            const deletedAttendees = await this.eventAttendeesRepo
                .createQueryBuilder()
                .delete()
                .from(EventAttendees)
                .where('"eventId" = :eventId', { eventId })
                .execute();
            return deletedAttendees;
        }
        catch (e) {
            throw new BadRequestException(`Attendees not deleted for Event Id: ${eventId}`, e);
        }
    }

    public async deleteUserAttendees(userId: string) {
        try {
            const deletedAttendees = await this.eventAttendeesRepo
                .createQueryBuilder()
                .delete()
                .from(EventAttendees)
                .where('"userId" = :userId', { userId })
                .execute();
            return deletedAttendees;
        }
        catch (e) {
            throw new BadRequestException(`Attendees not deleted for User Id: ${userId}`, e);
        }
    }

    async updateAttendees(updateAttendeesDto: UpdateAttendeesDto, response: Response) {
        const apiId = APIID.ATTENDEES_UPDATE;
        try {
            const attendees = await this.eventAttendeesRepo.findOne({ where: { eventId: updateAttendeesDto.eventId, userId: updateAttendeesDto.userId } })
            if (!attendees) {
                return APIResponse.error(
                    response,
                    apiId,
                    `No record found for this: ${updateAttendeesDto.eventId} and ${updateAttendeesDto.userId}`,
                    'records not found.',
                    HttpStatus.NOT_FOUND,
                )
            }
            if (updateAttendeesDto.joinedLeftHistory && Object.keys(updateAttendeesDto.joinedLeftHistory).length > 0) {
                updateAttendeesDto.joinedLeftHistory = attendees.joinedLeftHistory.concat(updateAttendeesDto.joinedLeftHistory);
            }
            Object.assign(attendees, updateAttendeesDto);
            const updated_result = await this.eventAttendeesRepo.save(attendees);
            if (!updated_result) {
                throw new BadRequestException('Attendees updation failed');
            }
            return APIResponse.success(response, apiId, updateAttendeesDto, HttpStatus.OK, 'updated')
        }
        catch (e) {
            const errorMessage = e.message || 'Internal server error';
            return APIResponse.error(response, apiId, "Internal Server Error", errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
