import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { IOnlineMeetingLocator } from '../onlineMeeting.locator';
import { ERROR_MESSAGES } from '../../common/utils/constants.util';
import { AxiosResponse } from 'axios';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import {
  AttendanceRecord,
  InZoomMeetingUserDetails,
  UserDetails,
  ZoomParticipant,
} from '../../common/utils/types';

@Injectable()
export class ZoomService implements IOnlineMeetingLocator {
  private readonly accountId: string;
  private readonly username: string;
  private readonly password: string;
  private readonly authUrl: string;
  private readonly zoomPastMeetings: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.accountId = this.configService.get('ZOOM_ACCOUNT_ID');
    this.username = this.configService.get('ZOOM_USERNAME');
    this.password = this.configService.get('ZOOM_PASSWORD');
    this.authUrl = this.configService.get('ZOOM_AUTH_URL');
    this.zoomPastMeetings = this.configService.get('ZOOM_PAST_MEETINGS');
  }

  onModuleInit() {
    if (
      !this.accountId.trim().length ||
      !this.username.trim().length ||
      !this.password.trim().length ||
      !this.authUrl.trim().length ||
      !this.zoomPastMeetings.trim().length
    ) {
      throw new InternalServerErrorException(
        ERROR_MESSAGES.ENVIRONMENT_VARIABLES_MISSING,
      );
    }
  }

  async getToken(): Promise<string> {
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
      if (e.response && e.response.status === 404) {
        throw new BadRequestException(ERROR_MESSAGES.SERVICE_NOT_FOUND);
      }
      throw e;
    }
  }

  async getMeetingParticipantList(
    token: string,
    userArray: ZoomParticipant[],
    zoomMeetingId: string,
    url: string = '',
  ): Promise<ZoomParticipant[]> {
    const headers = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
    };

    let manualPageSize = 100;
    const finalUrl =
      `${this.zoomPastMeetings}/${zoomMeetingId}/participants?page_size=${manualPageSize}` +
      url;

    const response = await this.httpService.axiosRef.get(finalUrl, headers);

    const retrievedUsersArray = userArray.concat(response.data.participants);
    if (response.data.next_page_token) {
      let nextPath = `&next_page_token=${response.data.next_page_token}`;

      return await this.getMeetingParticipantList(
        token,
        retrievedUsersArray,
        zoomMeetingId,
        nextPath,
      );
    } else {
      return retrievedUsersArray;
    }
  }

  async getMeetingParticipantsEmail(
    meetingId: string,
  ): Promise<{ emailIds: string[]; inMeetingUserDetails: any[] }> {
    try {
      const token = await this.getToken();

      const userList = await this.getMeetingParticipantList(
        token,
        [],
        meetingId,
        '',
      );

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

  getParticipantAttendance(
    userList: UserDetails[],
    meetingParticipantDetails: InZoomMeetingUserDetails[],
  ): AttendanceRecord[] {
    const userDetailList = [];
    const userMap = new Map(userList.map((user) => [user.email, user]));
    meetingParticipantDetails.forEach(
      (participantDetail: InZoomMeetingUserDetails) => {
        const userDetailExists = userMap.get(participantDetail.user_email);
        if (userDetailExists) {
          userDetailList.push({ ...userDetailExists, ...participantDetail });
        }
      },
    );

    return userDetailList.map(
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
  }
}
