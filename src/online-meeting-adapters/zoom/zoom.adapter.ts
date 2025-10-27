import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  IOnlineMeetingLocator,
  CreateMeetingRequest,
} from '../onlineMeeting.locator';
import { ERROR_MESSAGES } from 'src/common/utils/constants.util';
import { AxiosResponse } from 'axios';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import {
  AttendanceRecord,
  InZoomMeetingUserDetails,
  UserDetails,
  ZoomParticipant,
  MeetingType,
  ApprovalType,
} from 'src/common/utils/types';
import { ParticipantListResponseDto } from './dto/participant-list-response.dto';
import { ZoomParticipantResponseDto } from './dto/zoom-participant-response.dto';

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

enum AuthMethod {
  S2S_OAUTH = 's2s_oauth',
  USERNAME_PASSWORD = 'username_password',
}

@Injectable()
export class ZoomService implements IOnlineMeetingLocator {
  private readonly logger = new Logger(ZoomService.name);
  private readonly accountId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly username: string;
  private readonly password: string;
  private readonly authUrl: string;
  private readonly apiBaseUrl: string;
  private readonly meetingsEndpoint: string;
  private readonly webinarsEndpoint: string;
  private readonly zoomPastMeetings: string;
  private readonly zoomPastWebinars: string;
  private readonly zoomHostId: string;
  private readonly authMethod: AuthMethod;

  // Token caching
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private readonly configService: ConfigService) {
    this.accountId = this.configService.get('ZOOM_ACCOUNT_ID') || '';
    this.clientId = this.configService.get('ZOOM_CLIENT_ID') || '';
    this.clientSecret = this.configService.get('ZOOM_CLIENT_SECRET') || '';
    this.username = this.configService.get('ZOOM_USERNAME') || '';
    this.password = this.configService.get('ZOOM_PASSWORD') || '';
    this.authUrl = this.configService.get('ZOOM_AUTH_URL') || '';
    this.apiBaseUrl = this.configService.get('ZOOM_API_BASE_URL') || '';
    this.meetingsEndpoint =
      this.configService.get('ZOOM_MEETINGS_ENDPOINT') || '';
    this.webinarsEndpoint =
      this.configService.get('ZOOM_WEBINARS_ENDPOINT') || '';
    this.zoomPastMeetings = this.configService.get('ZOOM_PAST_MEETINGS');
    this.zoomPastWebinars = this.configService.get('ZOOM_PAST_WEBINARS');
    this.zoomHostId = this.configService.get('ZOOM_HOST_ID');

    // Determine authentication method based on available credentials
    this.authMethod = this.determineAuthMethod();
  }

  /**
   * Converts UTC time to the specified timezone for Zoom API
   * Zoom expects start_time to be in the meeting's timezone, not UTC
   */
  private convertUtcToTimezone(utcTime: string, timezone: string): string {
    try {
      const utcDate = new Date(utcTime);
      
      // Convert UTC time to the specified timezone
      const timezoneDate = new Date(utcDate.toLocaleString('en-US', { timeZone: timezone }));
      
      // Format as ISO string without the 'Z' suffix (Zoom doesn't expect UTC indicator)
      // and ensure it's in the correct timezone format
      const year = timezoneDate.getFullYear();
      const month = String(timezoneDate.getMonth() + 1).padStart(2, '0');
      const day = String(timezoneDate.getDate()).padStart(2, '0');
      const hours = String(timezoneDate.getHours()).padStart(2, '0');
      const minutes = String(timezoneDate.getMinutes()).padStart(2, '0');
      const seconds = String(timezoneDate.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    } catch (error) {
      this.logger.warn(`Failed to convert timezone for ${utcTime} to ${timezone}, using original time`, error.message);
      // Fallback to original time if conversion fails
      return utcTime.replace('Z', '');
    }
  }

  private determineAuthMethod(): AuthMethod {
    const hasS2SCredentials =
      this.clientId && this.clientSecret && this.accountId;
    const hasUsernamePassword =
      this.username && this.password && this.accountId;

    if (hasS2SCredentials) {
      this.logger.log('Using Server-to-Server OAuth authentication');
      return AuthMethod.S2S_OAUTH;
    } else if (hasUsernamePassword) {
      this.logger.log('Using Username/Password authentication (legacy)');
      return AuthMethod.USERNAME_PASSWORD;
    } else {
      throw new InternalServerErrorException(
        'Neither S2S OAuth credentials (ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET) nor Username/Password credentials (ZOOM_USERNAME, ZOOM_PASSWORD) are configured. Please configure at least one authentication method.',
      );
    }
  }

  onModuleInit() {
    // Validate required fields based on authentication method
    if (this.authMethod === AuthMethod.S2S_OAUTH) {
      if (
        !this.accountId?.trim().length ||
        !this.clientId?.trim().length ||
        !this.clientSecret?.trim().length ||
        !this.authUrl?.trim().length ||
        !this.apiBaseUrl?.trim().length ||
        !this.meetingsEndpoint?.trim().length ||
        !this.webinarsEndpoint?.trim().length ||
        !this.zoomPastMeetings?.trim().length ||
        !this.zoomPastWebinars?.trim().length
      ) {
        throw new InternalServerErrorException(
          'Missing required environment variables for S2S OAuth authentication: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_AUTH_URL, ZOOM_API_BASE_URL, ZOOM_MEETINGS_ENDPOINT, ZOOM_WEBINARS_ENDPOINT, ZOOM_PAST_MEETINGS, ZOOM_PAST_WEBINARS',
        );
      }
    } else if (this.authMethod === AuthMethod.USERNAME_PASSWORD) {
      if (
        !this.accountId?.trim().length ||
        !this.username?.trim().length ||
        !this.password?.trim().length ||
        !this.authUrl?.trim().length ||
        !this.zoomPastMeetings?.trim().length ||
        !this.zoomPastWebinars?.trim().length
      ) {
        throw new InternalServerErrorException(
          'Missing required environment variables for Username/Password authentication: ZOOM_ACCOUNT_ID, ZOOM_USERNAME, ZOOM_PASSWORD, ZOOM_AUTH_URL, ZOOM_PAST_MEETINGS, ZOOM_PAST_WEBINARS',
        );
      }
    }
  }

  async getToken(): Promise<string> {
    try {
      let auth: string;

      if (this.authMethod === AuthMethod.S2S_OAUTH) {
        auth =
          'Basic ' +
          Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
            'base64',
          );
      } else {
        auth =
          'Basic ' +
          Buffer.from(`${this.username}:${this.password}`).toString('base64');
      }

      const tokenResponse: AxiosResponse<ZoomTokenResponse> = await axios.post(
        `${this.authUrl}?grant_type=account_credentials&account_id=${this.accountId}`,
        {},
        {
          headers: {
            Accept: 'application/json',
            Authorization: auth,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      // Cache the token with expiry (subtract 60 seconds for safety)
      this.cachedToken = tokenResponse.data.access_token;
      this.tokenExpiry =
        Date.now() + (tokenResponse.data.expires_in - 60) * 1000;

      this.logger.log(
        `Successfully obtained Zoom access token using ${this.authMethod} authentication`,
      );
      return this.cachedToken;
    } catch (error) {
      this.logger.error(
        `Failed to obtain Zoom access token using ${this.authMethod} authentication`,
        error,
      );
      if (error.response?.status === 404) {
        throw new BadRequestException(ERROR_MESSAGES.SERVICE_NOT_FOUND);
      }
      throw error;
    }
  }

  /**
   * Create a Zoom meeting or webinar
   * Endpoints:
   * - Meetings: POST https://api.zoom.us/v2/users/me/meetings
   * - Webinars: POST https://api.zoom.us/v2/users/me/webinars
   */
  async createMeeting(
    request: CreateMeetingRequest,
    meetingType: MeetingType,
  ): Promise<any> {
    // Check if we can create meetings with current auth method
    if (this.authMethod === AuthMethod.USERNAME_PASSWORD) {
      throw new BadRequestException(
        'Meeting creation is not supported with Username/Password authentication. Please upgrade to Server-to-Server OAuth by configuring ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET.',
      );
    }

    try {
      const token = await this.getToken();

      // Use proper endpoints based on meeting type
      const endpoint =
        meetingType === MeetingType.webinar
          ? `${this.apiBaseUrl}/users/${this.zoomHostId}/webinars` // https://api.zoom.us/v2/users/me/webinars
          : `${this.apiBaseUrl}/users/${this.zoomHostId}/meetings`; // https://api.zoom.us/v2/users/me/meetings
      
      const meetingData = {
        topic: request.topic,
        type: meetingType === MeetingType.webinar ? 5 : 2, // 2 for scheduled meeting, 5 for webinar
        start_time: request.startTime,
        duration: request.duration,
        timezone: request.timezone || 'UTC',
        password: request.password,
        settings: {
          host_video: request.settings?.hostVideo ?? true,
          participant_video: request.settings?.participantVideo ?? true,
          join_before_host: request.settings?.joinBeforeHost ?? false,
          mute_upon_entry: request.settings?.muteUponEntry ?? true,
          watermark: request.settings?.watermark ?? false,
          use_pmi: request.settings?.usePmi ?? false,
          approval_type: request.approvalType ?? ApprovalType.AUTOMATIC,
          audio: request.settings?.audio ?? 'both',
          auto_recording: request.settings?.autoRecording ?? 'none',
          registrants_confirmation_email:
            request.settings?.registrantsConfirmationEmail ?? false,
          registrants_email_notification:
            request.settings?.registrantsEmailNotification ?? false,
          waiting_room: request.settings?.waitingRoom ?? false,
          jbh_time: request.settings?.jbhTime ?? 0,
        },
      };

      this.logger.log(`Creating ${meetingType} with endpoint: ${endpoint}`);

      const response: AxiosResponse<any> = await axios.post(
        endpoint,
        meetingData,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );

      this.logger.log(`Successfully created Zoom ${meetingType}`, {
        id: response.data.id,
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create Zoom ${meetingType}`, error.message);

      // ✅ Enhanced error handling based on Zoom API documentation
      const zoomError = this.categorizeZoomError(error, meetingType, 'create');
      throw zoomError;
    }
  }

  /**
   * Update a Zoom meeting or webinar
   * Endpoints:
   * - Meetings: PATCH https://api.zoom.us/v2/meetings/{meetingId}
   * - Webinars: PATCH https://api.zoom.us/v2/webinars/{webinarId}
   */
  async updateMeeting(
    meetingId: string,
    request: Partial<CreateMeetingRequest>,
    meetingType: MeetingType,
  ): Promise<any> {
    // Check if we can update meetings with current auth method
    if (this.authMethod === AuthMethod.USERNAME_PASSWORD) {
      throw new BadRequestException(
        'Meeting updates are not supported with Username/Password authentication. Please upgrade to Server-to-Server OAuth by configuring ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET.',
      );
    }

    try {
      const token = await this.getToken();

      // Use proper endpoints based on meeting type
      const endpoint =
        meetingType === MeetingType.webinar
          ? `${this.apiBaseUrl}/webinars/${meetingId}` // https://api.zoom.us/v2/webinars/{webinarId}
          : `${this.apiBaseUrl}/meetings/${meetingId}`; // https://api.zoom.us/v2/meetings/{meetingId}

      const updateData: any = {};
      if (request.topic) updateData.topic = request.topic;
      if (request.startTime) {
        updateData.start_time = request.startTime;
      }
      if (request.duration) updateData.duration = request.duration;
      if (request.timezone) updateData.timezone = request.timezone;
      if (request.password) updateData.password = request.password;

      if (request.settings || request.approvalType) {
        updateData.settings = {};
        if (request.settings?.hostVideo !== undefined)
          updateData.settings.host_video = request.settings.hostVideo;
        if (request.settings?.participantVideo !== undefined)
          updateData.settings.participant_video =
            request.settings.participantVideo;
        if (request.settings?.joinBeforeHost !== undefined)
          updateData.settings.join_before_host =
            request.settings.joinBeforeHost;
        if (request.settings?.muteUponEntry !== undefined)
          updateData.settings.mute_upon_entry = request.settings.muteUponEntry;
        if (request.settings?.watermark !== undefined)
          updateData.settings.watermark = request.settings.watermark;
        if (request.settings?.usePmi !== undefined)
          updateData.settings.use_pmi = request.settings.usePmi;
        if (request.approvalType !== undefined)
          updateData.settings.approval_type = request.approvalType;
        if (request.settings?.audio)
          updateData.settings.audio = request.settings.audio;
        if (request.settings?.autoRecording)
          updateData.settings.auto_recording = request.settings.autoRecording;
        if (request.settings?.registrantsConfirmationEmail !== undefined)
          updateData.settings.registrants_confirmation_email =
            request.settings.registrantsConfirmationEmail;
        if (request.settings?.registrantsEmailNotification !== undefined)
          updateData.settings.registrants_email_notification =
            request.settings.registrantsEmailNotification;
        if (request.settings?.waitingRoom !== undefined)
          updateData.settings.waiting_room = request.settings.waitingRoom;
        if (request.settings?.jbhTime !== undefined)
          updateData.settings.jbh_time = request.settings.jbhTime;
      }

      const response = await axios.patch(endpoint, updateData, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('response', response);
      // Return the response data for local sync
      return response.status === 204 ? true : false;
    } catch (error) {
      this.logger.error(`Failed to update Zoom ${meetingType}`, error.message);

      // ✅ Enhanced error handling based on Zoom API documentation
      const zoomError = this.categorizeZoomError(error, meetingType, 'update');
      throw zoomError;
    }
  }

  /**
   * Delete a Zoom meeting or webinar
   * Endpoints:
   * - Meetings: DELETE https://api.zoom.us/v2/meetings/{meetingId}
   * - Webinars: DELETE https://api.zoom.us/v2/webinars/{webinarId}
   */
  async deleteMeeting(
    meetingId: string,
    meetingType: MeetingType,
  ): Promise<void> {
    // Check if we can delete meetings with current auth method
    if (this.authMethod === AuthMethod.USERNAME_PASSWORD) {
      throw new BadRequestException(
        'Meeting deletion is not supported with Username/Password authentication. Please upgrade to Server-to-Server OAuth by configuring ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET.',
      );
    }

    try {
      const token = await this.getToken();

      // Use proper endpoints based on meeting type
      const endpoint =
        meetingType === MeetingType.webinar
          ? `${this.apiBaseUrl}/webinars/${meetingId}` // https://api.zoom.us/v2/webinars/{webinarId}
          : `${this.apiBaseUrl}/meetings/${meetingId}`; // https://api.zoom.us/v2/meetings/{meetingId}

      this.logger.log(
        `Deleting ${meetingType} ${meetingId} with endpoint: ${endpoint}`,
      );

      await axios.delete(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          schedule_for_reminder: false,
          cancel_meeting_reminder: 'all',
        },
      });

      this.logger.log(`Successfully deleted Zoom ${meetingType}`, {
        id: meetingId,
      });
    } catch (error) {
      this.logger.error(`Failed to delete Zoom ${meetingType}`, error.message);

      // ✅ Enhanced error handling based on Zoom API documentation
      const zoomError = this.categorizeZoomError(error, meetingType, 'delete');
      throw zoomError;
    }
  }

  /**
   * Get participant list for meetings and webinars
   * Endpoint: GET https://api.zoom.us/v2/report/meetings/{meetingId}/participants
   * Endpoint: GET https://api.zoom.us/v2/report/webinars/{webinarId}/participants
   */
  async getMeetingParticipantList(
    token: string,
    userArray: ZoomParticipant[],
    zoomId: string,
    meetingType: MeetingType,
    url: string = '',
    pageSize: number = 300,
  ): Promise<ZoomParticipantResponseDto> {
    const headers = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
    };

    const baseEndpoint = meetingType === MeetingType.webinar 
      ? this.zoomPastWebinars 
      : this.zoomPastMeetings;
    
    const finalUrl =
      `${baseEndpoint}/${zoomId}/participants?include_fields=registrant_id,user_email&page_size=${pageSize}` +
      url;
      console.log('finalUrl', finalUrl);
    try {
      const response = await axios.get(finalUrl, headers);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get meeting participant list`, error.message);
      throw error;
    }

    //  We should not use this as it is not efficient to fetch all participants at once, we should use the next_page_token to fetch the next page of participants using the same endpoint    // const retrievedUsersArray = userArray.concat(response.data.participants);
    // if (response.data.next_page_token) {
    //   const nextPath = `&next_page_token=${response.data.next_page_token}`;

    //   return await this.getMeetingParticipantList(
    //     token,
    //     retrievedUsersArray,
    //     zoomId,
    //     meetingType,
    //     nextPath,
    //   );
    // } else {
    //   return retrievedUsersArray;
    // }
  }

  /**
   * Categorize Zoom API errors based on HTTP status codes and error types
   * Based on: https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/meetingUpdate
   */
  private categorizeZoomError(
    error: any,
    meetingType: MeetingType,
    operation: string,
  ): Error {
    let errorMessage = `Zoom ${meetingType} ${operation} failed`;
    let errorType = 'ZOOM_API_ERROR';

    if (error.response?.status === 400) {
      errorMessage = `Invalid data sent to Zoom API for ${meetingType} ${operation} - check parameters`;
      errorType = 'ZOOM_BAD_REQUEST';
    } else if (error.response?.status === 401) {
      errorMessage = `Zoom authentication failed for ${meetingType} ${operation} - token expired or invalid`;
      errorType = 'ZOOM_UNAUTHORIZED';
    } else if (error.response?.status === 403) {
      errorMessage = `Insufficient permissions to ${operation} this Zoom ${meetingType}`;
      errorType = 'ZOOM_FORBIDDEN';
    } else if (error.response?.status === 404) {
      errorMessage = `Zoom ${meetingType} not found for ${operation} - may have been deleted`;
      errorType = 'ZOOM_NOT_FOUND';
    } else if (error.response?.status === 409) {
      errorMessage = `${meetingType} ${operation} conflicts with existing schedule`;
      errorType = 'ZOOM_CONFLICT';
    } else if (error.response?.status === 429) {
      errorMessage = `Too many requests to Zoom API for ${meetingType} ${operation} - rate limited`;
      errorType = 'ZOOM_RATE_LIMITED';
    } else if (error.response?.status >= 500) {
      errorMessage = `Zoom service temporarily unavailable for ${meetingType} ${operation}`;
      errorType = 'ZOOM_SERVICE_UNAVAILABLE';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorMessage = `Cannot connect to Zoom service for ${meetingType} ${operation}`;
      errorType = 'ZOOM_CONNECTION_ERROR';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = `Zoom API request timed out for ${meetingType} ${operation}`;
      errorType = 'ZOOM_TIMEOUT';
    }

    // Create enhanced error with additional context
    const enhancedError = new Error(errorMessage);
    (enhancedError as any).zoomErrorType = errorType;
    (enhancedError as any).originalError = error;
    (enhancedError as any).operation = operation;
    (enhancedError as any).meetingType = meetingType;

    return enhancedError;
  }

  async getMeetingParticipantsIdentifiers(
    meetingId: string,
    markAttendanceBy: string,
    meetingType: MeetingType,
    pageSize: number = 300,
  ): Promise<ParticipantListResponseDto> {
    try {
      const token = await this.getToken();
      let identifiers: string[] = [];

      const userList = await this.getMeetingParticipantList(
        token,
        [],
        meetingId,
        meetingType,
        '',
        pageSize,
      );

      const inMeetingUserDetails = userList.participants.filter((user) => {
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

      return {
        identifiers,
        inMeetingUserDetails,
        next_page_token: userList.next_page_token,
        page_count: userList.page_count,
        page_size: userList.page_size,
        total_records: userList.total_records,
      };
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

  /**
   * Add registrant to Zoom meeting or webinar
   * Endpoints:
   * - Meetings: POST https://api.zoom.us/v2/meetings/{meetingId}/registrants
   * - Webinars: POST https://api.zoom.us/v2/webinars/{webinarId}/registrants
   */
  async addRegistrantToMeeting(
    meetingId: string,
    registrantData: {
      email: string;
      first_name: string;
      last_name: string;
    },
    meetingType: MeetingType = MeetingType.meeting,
  ): Promise<any> {
    try {
      const token = await this.getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Use proper endpoints based on meeting type
      const endpoint =
        meetingType === MeetingType.webinar
          ? `${this.apiBaseUrl}/webinars/${meetingId}/registrants` // https://api.zoom.us/v2/webinars/{webinarId}/registrants
          : `${this.apiBaseUrl}/meetings/${meetingId}/registrants`; // https://api.zoom.us/v2/meetings/{meetingId}/registrants

      this.logger.log(
        `Adding registrant to ${meetingType} ${meetingId} with endpoint: ${endpoint}`,
      );

      const response = await axios.post(endpoint, registrantData, { headers });

      this.logger.log('RESPONSE', response.data);
      if (response.status === 201) {
        this.logger.log(`Successfully added registrant to ${meetingType}`, {
          meetingId,
          email: registrantData.email,
        });
        return response.data;
      } else {
        throw new BadRequestException(
          `Failed to add registrant to ${meetingType === MeetingType.webinar ? 'webinar' : 'meeting'}: ${response.statusText}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error adding registrant to ${meetingType}: ${error.message}`,
      );
      if (error.response?.status === 400) {
        throw new BadRequestException(
          `User with email ${registrantData.email} is already registered for this ${meetingType === MeetingType.webinar ? 'webinar' : 'meeting'}`,
        );
      }
      throw new BadRequestException(
        `Failed to add registrant to ${meetingType === MeetingType.webinar ? 'webinar' : 'meeting'}: ${error.message}`,
      );
    }
  }

  /**
   * Get meeting details
   * Endpoints:
   * - Meetings: GET https://api.zoom.us/v2/meetings/{meetingId}
   * - Webinars: GET https://api.zoom.us/v2/webinars/{webinarId}
   */
  async getMeetingDetails(
    meetingId: string,
    meetingType: MeetingType = MeetingType.meeting,
  ): Promise<any> {
    try {
      const token = await this.getToken();

      // Use proper endpoints based on meeting type
      const endpoint =
        meetingType === MeetingType.webinar
          ? `${this.apiBaseUrl}/webinars/${meetingId}` // https://api.zoom.us/v2/webinars/{webinarId}
          : `${this.apiBaseUrl}/meetings/${meetingId}`; // https://api.zoom.us/v2/meetings/{meetingId}

      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get ${meetingType} details`, error.message);
      throw new BadRequestException(
        `Failed to get ${meetingType} details: ${error.message}`,
      );
    }
  }

  /**
   * List meetings or webinars
   * Endpoints:
   * - Meetings: GET https://api.zoom.us/v2/users/me/meetings
   * - Webinars: GET https://api.zoom.us/v2/users/me/webinars
   */
  async listMeetings(
    meetingType: MeetingType = MeetingType.meeting,
    query: any = {},
  ): Promise<any> {
    try {
      const token = await this.getToken();

      // Use proper endpoints based on meeting type
      const endpoint =
        meetingType === MeetingType.webinar
          ? this.webinarsEndpoint // https://api.zoom.us/v2/users/me/webinars
          : this.meetingsEndpoint; // https://api.zoom.us/v2/users/me/meetings

      this.logger.log(`Listing ${meetingType}s with endpoint: ${endpoint}`);

      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        params: query,
      });

      this.logger.log(`Successfully retrieved ${meetingType} list`, {
        count:
          response.data[
            meetingType === MeetingType.webinar ? 'webinars' : 'meetings'
          ]?.length || 0,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to list ${meetingType}s`, error.message);
      throw new BadRequestException(
        `Failed to list ${meetingType}s: ${error.message}`,
      );
    }
  }

  /**
   * Remove registrant from Zoom meeting or webinar
   * Endpoints:
   * - Meetings: DELETE https://api.zoom.us/v2/meetings/{meetingId}/registrants/{registrantId}
   * - Webinars: DELETE https://api.zoom.us/v2/webinars/{webinarId}/registrants/{registrantId}
   */
  async removeRegistrantFromMeeting(
    meetingId: string,
    registrantId: string,
    meetingType: MeetingType = MeetingType.meeting,
  ): Promise<any> {
    try {
      const token = await this.getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Use proper endpoints based on meeting type
      const endpoint =
        meetingType === MeetingType.webinar
          ? `${this.apiBaseUrl}/webinars/${meetingId}/registrants/${registrantId}` // https://api.zoom.us/v2/webinars/{webinarId}/registrants/{registrantId}
          : `${this.apiBaseUrl}/meetings/${meetingId}/registrants/${registrantId}`; // https://api.zoom.us/v2/meetings/{meetingId}/registrants/{registrantId}

      this.logger.log(
        `Removing registrant from ${meetingType} ${meetingId} with endpoint: ${endpoint}`,
      );

      const response = await axios.delete(endpoint, { headers });

      if (response.status === 204) {
        this.logger.log(`Successfully removed registrant from ${meetingType}`, {
          meetingId,
          registrantId,
        });
        return { success: true };
      } else {
        throw new BadRequestException(
          `Failed to remove registrant from ${meetingType === MeetingType.webinar ? 'webinar' : 'meeting'}: ${response.statusText}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error removing registrant from ${meetingType}: ${error.message}`,
      );
      if (error.response?.status === 404) {
        throw new BadRequestException(
          `Registrant ${registrantId} not found for this ${meetingType === MeetingType.webinar ? 'webinar' : 'meeting'}`,
        );
      }
      throw new BadRequestException(
        `Failed to remove registrant from ${meetingType === MeetingType.webinar ? 'webinar' : 'meeting'}: ${error.message}`,
      );
    }
  }
}
