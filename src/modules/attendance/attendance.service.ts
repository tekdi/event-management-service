import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { Response } from 'express';
import APIResponse from '../../common/utils/response';
import { MarkZoomAttendanceDto } from './dto/MarkZoomAttendance.dto';
import { API_ID } from '../../common/utils/constants.util';

@Injectable()
export class AttendanceService implements OnModuleInit {
  // utilize apis of the attendance service to mark event attendance

  private readonly userServiceUrl: string;
  private readonly attendanceServiceUrl: string;
  private readonly accountId: string;
  private readonly username: string;
  private readonly password: string;
  private readonly authUrl: string;
  private readonly zoomPastMeetings: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.userServiceUrl = this.configService.get('USER_SERVICE');
    this.attendanceServiceUrl = this.configService.get('ATTENDANCE_SERVICE');
    this.accountId = this.configService.get('ZOOM_ACCOUNT_ID');
    this.username = this.configService.get('ZOOM_USERNAME');
    this.password = this.configService.get('ZOOM_PASSWORD');
    this.authUrl = this.configService.get('ZOOM_AUTH_URL');
    this.zoomPastMeetings = this.configService.get('ZOOM_PAST_MEETINGS');
  }

  onModuleInit() {
    if (
      !this.userServiceUrl.trim().length ||
      !this.attendanceServiceUrl.trim().length ||
      !this.accountId.trim().length ||
      !this.username.trim().length ||
      !this.password.trim().length ||
      !this.authUrl.trim().length ||
      !this.zoomPastMeetings.trim().length
    ) {
      throw new InternalServerErrorException('Environment variables missing!');
    }
  }

  async markAttendanceForZoomMeetingParticipants(
    markZoomAttendanceDto: MarkZoomAttendanceDto,
    userId: string,
    response: Response,
  ) {
    const apiId = API_ID.MARK_ZOOM_ATTENDANCE;

    const participantEmails = await this.getZoomMeetingParticipantsEmail(
      markZoomAttendanceDto.zoomMeetingId,
    );

    // get userids from email list in user service

    const userList = await this.getUserIdList(participantEmails);

    // mark attendance for each user
    const res = await this.markUsersAttendance(
      userList,
      markZoomAttendanceDto,
      userId,
    );

    return response
      .status(HttpStatus.CREATED)
      .json(APIResponse.success(apiId, res, 'Created'));
  }

  async getUserIdList(emailList: string[]): Promise<string[]> {
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
        throw new BadRequestException('No users found');
      }

      return userDetails.map(({ userId }) => userId);
    } catch (e) {
      if (e.status === 404) {
        throw new BadRequestException('Service not found');
      }
      throw e;
    }
  }

  async markUsersAttendance(
    userIds: string[],
    markZoomAttendanceDto: MarkZoomAttendanceDto,
    loggedInUserId: string,
  ): Promise<any> {
    // mark attendance for each user
    try {
      const userAttendance = userIds.map((userId) => ({
        userId,
        attendance: 'present',
      }));

      const attendanceMarkResponse = await this.httpService.axiosRef.post(
        `${this.attendanceServiceUrl}/api/v1/attendance/bulkAttendance`,
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
  ): Promise<string[]> {
    try {
      const token = await this.getZoomToken();

      const userList = await this.getZoomParticipantList(
        token,
        [],
        zoomMeetingId,
      );

      const emailIds = userList
        .filter(({ user_email, status }) => {
          if (status === 'in_meeting') return user_email;
        })
        .map(({ user_email }) => user_email);

      if (!emailIds.length) {
        throw new BadRequestException('No participants found for meeting');
      }

      return emailIds;
    } catch (e) {
      if (e.status === 404) {
        throw new BadRequestException('Meeting not found');
      }
      throw e;
    }
  }

  async getZoomToken() {
    try {
      const auth =
        'Basic ' +
        Buffer.from(this.username + ':' + this.password).toString('base64');

      const tokenResponse: AxiosResponse = await this.httpService.axiosRef.post(
        `${this.authUrl}?grant_type=account_credentials&account_id=${this.accountId}`,
        {},
        {
          headers: {
            Accept: 'application/json',
            Authorization: auth,
          },
        },
      );

      return tokenResponse.data.access_token;
    } catch (e) {
      if (e.status === 404) {
        throw new BadRequestException('Service not found');
      }
      throw e;
    }
  }

  async getZoomParticipantList(
    token: string,
    userArray: any[],
    meetId: string,
    url = '',
  ) {
    const headers = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
    };

    let manualPageSize = 100;
    const finalUrl =
      `${this.zoomPastMeetings}/${meetId}/participants?page_size=${manualPageSize}` +
      url;

    return await this.httpService.axiosRef
      .get(finalUrl, headers)
      .then((response) => {
        const retrievedUsersArray = userArray.concat(
          response.data.participants,
        );
        if (response.data.next_page_token) {
          let nextPath = `&next_page_token=${response.data.next_page_token}`;

          return this.getZoomParticipantList(
            token,
            retrievedUsersArray,
            meetId,
            nextPath,
          );
        } else {
          return retrievedUsersArray;
        }
      });
  }
}
