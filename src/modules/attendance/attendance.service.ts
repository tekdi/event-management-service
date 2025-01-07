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
import { MarkZoomAttendanceDto } from './dto/MarkZoomAttendance.dto';
import {
  API_ID,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from 'src/common/utils/constants.util';
import { OnlineMeetingAdapter } from 'src/online-meeting-adapters/onlineMeeting.adapter';

@Injectable()
export class AttendanceService implements OnModuleInit {
  // utilize apis of the attendance service to mark event attendance

  private readonly userServiceUrl: string;
  private readonly attendanceServiceUrl: string;

  constructor(
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
        ERROR_MESSAGES.ENVIRONMENT_VARIABLES_MISSING,
      );
    }
  }

  async markAttendanceForZoomMeetingParticipants(
    markZoomAttendanceDto: MarkZoomAttendanceDto,
    userId: string,
    response: Response,
  ) {
    const apiId = API_ID.MARK_EVENT_ATTENDANCE;

    const participantEmails = await this.getZoomMeetingParticipantsEmail(
      markZoomAttendanceDto.zoomMeetingId,
    );

    // get userIds from email list in user service

    const userList = await this.getUserIdList(participantEmails.emailIds);

    const userDetailList = [];
    const userMap = new Map(userList.map((user) => [user.email, user]));
    participantEmails.inMeetingUserDetails.forEach((element) => {
      const ele = userMap.get(element.user_email);
      if (ele) {
        userDetailList.push({ ...ele, ...element });
      }
    });

    // mark attendance for each user
    const res = await this.markUsersAttendance(
      userDetailList,
      markZoomAttendanceDto,
      userId,
    );

    return response
      .status(HttpStatus.CREATED)
      .json(
        APIResponse.success(
          apiId,
          res,
          SUCCESS_MESSAGES.ATTENDANCE_MARKED_FOR_ZOOM_MEETING,
        ),
      );
  }

  async getUserIdList(emailList: string[]): Promise<
    {
      userId: string;
      username: string;
      email: string;
      name: string;
      role: string;
      mobile: string;
      createdBy: string;
      updatedBy: string;
      createdAt: string;
      updatedAt: string;
      status: string;
      total_count: string;
    }[]
  > {
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
        throw new BadRequestException();
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
    userDetails: any[],
    markZoomAttendanceDto: MarkZoomAttendanceDto,
    loggedInUserId: string,
  ): Promise<any> {
    // mark attendance for each user
    try {
      const userAttendance = userDetails.map(
        ({ userId, duration, join_time, leave_time }) => ({
          userId,
          attendance: 'present',
          metaData: {
            duration,
            joinTime: join_time,
            leaveTime: leave_time,
          },
        }),
      );

      const attendanceMarkResponse = await this.httpService.axiosRef.post(
        `${this.attendanceServiceUrl}/api/v1/attendance/bulkAttendance?userId=${loggedInUserId}`,
        {
          attendanceDate: markZoomAttendanceDto.attendanceDate,
          contextId: markZoomAttendanceDto.eventId,
          scope: markZoomAttendanceDto.scope,
          context: 'event',
          userAttendance,
        },
        {
          headers: {
            Accept: 'application/json',
            tenantid: markZoomAttendanceDto.tenantId,
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

  async getZoomMeetingParticipantsEmail(
    zoomMeetingId: string,
  ): Promise<{ emailIds: string[]; inMeetingUserDetails: any[] }> {
    try {
      const token = await this.onlineMeetingAdapter.getAdapter().getToken();

      const userList = await this.onlineMeetingAdapter
        .getAdapter()
        .getMeetingParticipantList(token, [], zoomMeetingId, '');

      const inMeetingUserDetails = userList.filter(({ user_email, status }) => {
        if (status === 'in_meeting') return user_email;
      });

      const emailIds = inMeetingUserDetails.map(({ user_email }) => user_email);

      if (!emailIds.length) {
        throw new BadRequestException(ERROR_MESSAGES.NO_PARTICIPANTS_FOUND);
      }

      return { emailIds, inMeetingUserDetails };
    } catch (e) {
      if (e.status === 404) {
        throw new BadRequestException(ERROR_MESSAGES.MEETING_NOT_FOUND);
      }
      throw e;
    }
  }
}
