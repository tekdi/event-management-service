import { HttpService } from '@nestjs/axios';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import e, { Response } from 'express';
import APIResponse from 'src/common/utils/response';

@Injectable()
export class AttendanceService {
  // utilize apis of the attendance service to mark event attendance

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async markAttendanceForZoomMeetingParticipants(
    zoomMeetingId: string,
    response: Response,
  ) {
    const apiId = 'mark.event.attendance';

    const participantEmails =
      await this.getZoomMeetingParticipantsEmail(zoomMeetingId);

    // get userids from email list in user service

    // mark attendance for each user
    const res = await this.markUsersAttendance(
      [
        '2ce64c1b-25ee-467c-a7e9-ef95308e36c0',
        'd2f068ae-be74-4f58-b97f-d43dfb67b20d',
      ],
      'f6ab7955-f059-4ea0-b60b-01b410770d52',
      '2021-09-01',
      'student',
    );

    console.log(res, 'ress');

    return response
      .status(HttpStatus.CREATED)
      .json(APIResponse.success(apiId, participantEmails, 'Created'));
  }

  async markUsersAttendance(
    userIds: string[],
    eventId: string,
    attendanceDate: string,
    scope: string,
  ) {
    // mark attendance for each user
    const userAttendance = userIds.map((userId) => ({
      userId,
      attendance: 'present',
      remark: 'string',
      metaData: 'string',
      syncTime: 'string',
      session: 'string',
    }));

    const attendanceMarkResponse = await this.httpService.axiosRef.post(
      `http://localhost:3000/api/v1/attendance/bulkAttendance`,
      {
        attendanceDate,
        contextId: eventId,
        scope,
        context: 'event',
        userAttendance,
      },
      {
        headers: {
          Accept: 'application/json',
          tenantid: '3efe90e5-e62c-4030-a0a5-6cecd64f77f6',
          userId: '87173f64-09de-4572-bd31-a22dbe259e09',
        },
      },
    );

    return attendanceMarkResponse.data;
  }

  async getZoomMeetingParticipantsEmail(zoomMeetingId: string) {
    try {
      const token = await this.getZoomToken();

      console.log(token, 'tokkkkkeenn');

      const userList = await this.getUserList(token, [], zoomMeetingId);
      console.log(userList);

      const emailIds = userList.filter(({ user_email, status }) => {
        if (status === 'in_meeting') return user_email;
      });

      return emailIds;
    } catch (e) {
      console.log(e, 'errror');
      return e;
    }
  }

  async getZoomToken() {
    try {
      const accountId = this.configService.get('ZOOM_ACCOUNT_ID');
      const username = this.configService.get('ZOOM_USERNAME');
      const password = this.configService.get('ZOOM_PASSWORD');
      const authUrl = this.configService.get('ZOOM_AUTH_URL');
      const auth =
        'Basic ' + Buffer.from(username + ':' + password).toString('base64');

      const tokenResponse: AxiosResponse = await this.httpService.axiosRef.post(
        `${authUrl}?grant_type=account_credentials&account_id=${accountId}`,
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
      console.log(e);
      throw e;
    }
  }

  async getUserList(token: string, userArray: any[], meetId: string, url = '') {
    const headers = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
    };

    let manualPageSize = 1;
    const finalUrl =
      `https://api.zoom.us/v2/past_meetings/${meetId}/participants?page_size=${manualPageSize}` +
      url;

    return await this.httpService.axiosRef
      .get(finalUrl, headers)
      .then((response) => {
        const retrievedUsersArray = userArray.concat(
          response.data.participants,
        );
        if (response.data.next_page_token) {
          console.log('if');

          let nextPath = `&next_page_token=${response.data.next_page_token}`;

          console.log(nextPath, 'nextPath');
          return this.getUserList(token, retrievedUsersArray, meetId, nextPath);
        } else {
          console.log('else');
          return retrievedUsersArray;
        }
      });
  }
}
