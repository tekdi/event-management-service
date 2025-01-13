import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { MarkMeetingAttendanceDto } from './dto/MarkAttendance.dto';
import {
  API_ID,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from 'src/common/utils/constants.util';
import { OnlineMeetingAdapter } from 'src/online-meeting-adapters/onlineMeeting.adapter';
import { AttendanceRecord, UserDetails } from 'src/common/utils/types';
import { EventRepetition } from '../event/entities/eventRepetition.entity';
import { Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LoggerWinston } from 'src/common/logger/logger.util';

@Injectable()
export class AttendanceService implements OnModuleInit {
  // utilize apis of the attendance service to mark event attendance

  private readonly userServiceUrl: string;
  private readonly attendanceServiceUrl: string;

  constructor(
    @InjectRepository(EventRepetition)
    private readonly eventRepetitionRepository: Repository<EventRepetition>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly onlineMeetingAdapter: OnlineMeetingAdapter,
  ) {
    this.userServiceUrl = this.configService.get('USER_SERVICE');
    this.attendanceServiceUrl = this.configService.get('ATTENDANCE_SERVICE');
  }

  onModuleInit() {
    if (
      !this.userServiceUrl.trim().length ||
      !this.attendanceServiceUrl.trim().length
    ) {
      throw new InternalServerErrorException(
        `${ERROR_MESSAGES.ENVIRONMENT_VARIABLES_MISSING}: USER_SERVICE, ATTENDANCE_SERVICE`,
      );
    }
  }

  async markAttendanceForMeetingParticipants(
    markMeetingAttendanceDto: MarkMeetingAttendanceDto,
    userId: string,
    response: Response,
  ) {
    const apiId = API_ID.MARK_EVENT_ATTENDANCE;

    // check event exists
    const eventRepetition = await this.eventRepetitionRepository.findOne({
      where: {
        eventRepetitionId: markMeetingAttendanceDto.eventRepetitionId,
        eventDetail: {
          status: Not('archived'),
        },
      },
    });

    if (!eventRepetition) {
      throw new BadRequestException(ERROR_MESSAGES.EVENT_DOES_NOT_EXIST);
    }

    const participantEmails = await this.onlineMeetingAdapter
      .getAdapter()
      .getMeetingParticipantsEmail(markMeetingAttendanceDto.meetingId);

    // get userIds from email list in user service
    const userList: UserDetails[] = await this.getUserIdList(
      participantEmails.emailIds,
    );

    const userDetailList = this.onlineMeetingAdapter
      .getAdapter()
      .getParticipantAttendance(
        userList,
        participantEmails.inMeetingUserDetails,
      );

    // mark attendance for each user
    const res = await this.markUsersAttendance(
      userDetailList,
      markMeetingAttendanceDto,
      userId,
    );

    LoggerWinston.log(
      SUCCESS_MESSAGES.ATTENDANCE_MARKED_FOR_MEETING,
      apiId,
      userId,
    );

    return response
      .status(HttpStatus.CREATED)
      .json(
        APIResponse.success(
          apiId,
          res,
          SUCCESS_MESSAGES.ATTENDANCE_MARKED_FOR_MEETING,
        ),
      );
  }

  async getUserIdList(emailList: string[]): Promise<UserDetails[]> {
    // get userIds for emails provided from user service
    try {
      const userListResponse = await this.httpService.axiosRef.post(
        `${this.userServiceUrl}/user/v1/list`,
        {
          limit: emailList.length,
          offset: 0,
          filters: {
            email: emailList,
          },
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );

      const userDetails = userListResponse.data.result.getUserDetails;

      if (!userDetails.length) {
        throw new BadRequestException(ERROR_MESSAGES.NO_USERS_FOUND);
      }

      return userDetails;
    } catch (e) {
      if (e.status === 404) {
        throw new BadRequestException(ERROR_MESSAGES.SERVICE_NOT_FOUND);
      }
      throw e;
    }
  }

  async markUsersAttendance(
    userAttendance: AttendanceRecord[],
    markMeetingAttendanceDto: MarkMeetingAttendanceDto,
    loggedInUserId: string,
  ): Promise<any> {
    // mark attendance for each user in attendance service
    try {
      const attendanceMarkResponse = await this.httpService.axiosRef.post(
        `${this.attendanceServiceUrl}/api/v1/attendance/bulkAttendance?userId=${loggedInUserId}`,
        {
          attendanceDate: markMeetingAttendanceDto.attendanceDate,
          contextId: markMeetingAttendanceDto.eventRepetitionId,
          scope: markMeetingAttendanceDto.scope,
          context: 'event',
          userAttendance,
        },
        {
          headers: {
            Accept: 'application/json',
            tenantid: markMeetingAttendanceDto.tenantId,
            userId: loggedInUserId,
          },
        },
      );

      return attendanceMarkResponse.data;
    } catch (e) {
      if (e.status === 404) {
        throw new BadRequestException(
          `Service not found ${e?.response?.data?.message}`,
        );
      } else if (e.status === 400) {
        throw new BadRequestException(
          `Bad request ${e?.response?.data?.message}`,
        );
      }
      throw e;
    }
  }
}
