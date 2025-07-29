import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { IOnlineMeetingLocator } from '../onlineMeeting.locator';
import { ERROR_MESSAGES } from 'src/common/utils/constants.util';
import { AxiosResponse } from 'axios';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import {
  AttendanceRecord,
  InZoomMeetingUserDetails,
  UserDetails,
  ZoomParticipant,
} from 'src/common/utils/types';

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
    console.log('ZoomService environment config:', {
      accountId: this.accountId,
      username: this.username,
      password: this.password ? '**** (hidden)' : 'Not set',
      authUrl: this.authUrl,
      zoomPastMeetings: this.zoomPastMeetings,
    });
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

    const manualPageSize = 100;
    const finalUrl =
      `${this.zoomPastMeetings}/${zoomMeetingId}/participants?page_size=${manualPageSize}` +
      url;

    const response = await this.httpService.axiosRef.get(finalUrl, headers);

    const retrievedUsersArray = userArray.concat(response.data.participants);
    if (response.data.next_page_token) {
      const nextPath = `&next_page_token=${response.data.next_page_token}`;

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

  async getMeetingParticipantsIdentifiers(
    meetingId: string,
    markAttendanceBy: string,
  ): Promise<{ identifiers: string[]; inMeetingUserDetails: any[] }> {
    try {
      const token = await this.getToken();
      let identifiers: string[] = [];

      const userList = await this.getMeetingParticipantList(
        token,
        [],
        meetingId,
        '',
      );

      const inMeetingUserDetails = userList.filter((user) => {
        if (user.status === 'in_meeting') return user;
      });

      if (markAttendanceBy === 'email' || markAttendanceBy === 'username') {
        const key = markAttendanceBy === 'email' ? 'user_email' : 'name';
        identifiers = inMeetingUserDetails
          .filter((user) => user[key])
          .map((user) => user[key]);
      } else {
        throw new BadRequestException(
          ERROR_MESSAGES.INVALID_MARK_ATTENDANCE_BY,
        );
      }

      if (!identifiers.length) {
        throw new BadRequestException(ERROR_MESSAGES.NO_PARTICIPANTS_FOUND);
      }

      return { identifiers, inMeetingUserDetails };
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
    markAttendanceBy: string,
  ): AttendanceRecord[] {
    const userDetailList = [];
    let userMap: Map<string, UserDetails> = new Map();

    if (markAttendanceBy === 'email') {
      userMap = new Map(
        userList.map((user) => [user.email.toLowerCase(), user]),
      );
    } else if (markAttendanceBy === 'username') {
      userMap = new Map(
        userList.map((user) => [user.username.toLowerCase(), user]),
      );
    } else {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_MARK_ATTENDANCE_BY);
    }

    const key = markAttendanceBy === 'email' ? 'user_email' : 'name';
    meetingParticipantDetails.forEach(
      (participantDetail: InZoomMeetingUserDetails) => {
        const userDetailExists = userMap.get(
          participantDetail[key].toLowerCase(),
        );
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
          autoMarked: true,
          joinTime: join_time,
          leaveTime: leave_time,
        },
      }),
    );
  }
}
