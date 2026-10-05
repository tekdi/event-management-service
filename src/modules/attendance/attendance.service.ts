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
import { MarkMeetingAttendanceDto } from './dto/markAttendance.dto';
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
  private readonly onlineMeetingProvider: string;

  constructor(
    @InjectRepository(EventRepetition)
    private readonly eventRepetitionRepository: Repository<EventRepetition>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly onlineMeetingAdapter: OnlineMeetingAdapter,
  ) {
    this.userServiceUrl = this.configService.get('USER_SERVICE');
    this.attendanceServiceUrl = this.configService.get('ATTENDANCE_SERVICE');
    this.onlineMeetingProvider = this.configService.get(
      'ONLINE_MEETING_ADAPTER',
    );
  }

  onModuleInit() {
    if (
      !this.userServiceUrl.trim().length ||
      !this.attendanceServiceUrl.trim().length ||
      !this.onlineMeetingProvider.trim().length
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
    authToken: string,
  ) {
    const apiId = API_ID.MARK_EVENT_ATTENDANCE;

    // check event exists
    const eventRepetition = await this.eventRepetitionRepository.findOne({
      where: {
        eventRepetitionId: markMeetingAttendanceDto.eventRepetitionId,
        eventDetail: {
          status: Not('archived'),
          eventType: 'online',
        },
      },
      relations: ['eventDetail'], // Ensure eventDetail is included
      select: {
        eventRepetitionId: true,
        eventDetail: {
          onlineProvider: true,
          metadata: true as unknown as object,
        },
      },
    });

    if (
      !eventRepetition ||
      eventRepetition.eventDetail.onlineProvider.toLowerCase() !==
        this.onlineMeetingProvider.toLowerCase()
    ) {
      throw new BadRequestException(ERROR_MESSAGES.EVENT_DOES_NOT_EXIST);
    }

    // get meeting participants
    const participantIdentifiers = await this.onlineMeetingAdapter
      .getAdapter()
      .getMeetingParticipantsIdentifiers(
        markMeetingAttendanceDto.meetingId,
        markMeetingAttendanceDto.markAttendanceBy,
      );

    // get userIds from email or username list in user service
    const userList: UserDetails[] = await this.getUserIdList(
      participantIdentifiers.identifiers,
      markMeetingAttendanceDto.markAttendanceBy,
      authToken,
      markMeetingAttendanceDto.tenantId,
    );

    // combine data from user service and meeting attendance
    const userDetailList = this.onlineMeetingAdapter
      .getAdapter()
      .getParticipantAttendance(
        userList,
        participantIdentifiers.inMeetingUserDetails,
        markMeetingAttendanceDto.markAttendanceBy,
      );

    if (!userDetailList.length) {
      throw new BadRequestException(ERROR_MESSAGES.NO_USERS_FOUND);
    }

    // Restrict attendance to this event's cohort - the same Zoom link can be shared across
    // events/cohorts (e.g. via WhatsApp), so userDetailList may contain valid users who are
    // not actually enrolled in this event's cohort.
    const metadata = eventRepetition.eventDetail.metadata as
      | { cohortId?: string | string[]; cohortIds?: string[] }
      | undefined;
    // cohortIds (plural) is the canonical field since multi-cohort support was added;
    // cohortId (singular) is a legacy fallback kept only for events predating that migration.
    const cohortId = Array.isArray(metadata?.cohortIds) && metadata.cohortIds.length
      ? metadata.cohortIds.find(Boolean)
      : Array.isArray(metadata?.cohortId)
        ? metadata.cohortId.find(Boolean)
        : metadata?.cohortId;

    let scopedAttendanceList = userDetailList;
    if (cohortId) {
      const cohortMemberIds = await this.getCohortMemberIds(
        cohortId,
        markMeetingAttendanceDto.tenantId,
        authToken,
      );
      scopedAttendanceList = this.buildCohortScopedAttendance(
        cohortMemberIds,
        userDetailList,
      );
    }

    // mark attendance for each user
    const res = await this.markUsersAttendance(
      scopedAttendanceList,
      markMeetingAttendanceDto,
      userId,
      authToken,
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

  async getUserIdList(
    identifiers: string[],
    markAttendanceBy: string,
    authToken: string,
    tenantId: string,
  ): Promise<UserDetails[]> {
    // get userIds for emails or usernames provided from user service
    try {
      const filters = {};

      if (markAttendanceBy === 'email') {
        filters['email'] = identifiers;
      } else if (markAttendanceBy === 'username') {
        filters['username'] = identifiers;
      }
      const userListResponse = await this.httpService.axiosRef.post(
        `${this.userServiceUrl}/user/v1/list`,
        {
          limit: identifiers.length,
          offset: 0,
          filters,
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: authToken,
            tenantId: tenantId,
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
      throw new InternalServerErrorException(ERROR_MESSAGES.USER_SERVICE_ERROR);
    }
  }

  async markUsersAttendance(
    userAttendance: AttendanceRecord[],
    markMeetingAttendanceDto: MarkMeetingAttendanceDto,
    loggedInUserId: string,
    authToken: string,
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
            Authorization: authToken,
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
      throw new InternalServerErrorException(
        ERROR_MESSAGES.ATTENDANCE_SERVICE_ERROR,
      );
    }
  }

  // Restricts meeting attendance to the event's cohort members - meeting participants who
  // are valid users but not part of this cohort (e.g. joined a Zoom link shared outside their
  // batch) are dropped, and cohort members who did not join the meeting are marked absent.
  buildCohortScopedAttendance(
    cohortMemberIds: string[],
    meetingAttendance: AttendanceRecord[],
  ): AttendanceRecord[] {
    const meetingByUser = new Map(
      meetingAttendance.map((record) => [record.userId, record]),
    );

    return cohortMemberIds.map((userId) => {
      const record = meetingByUser.get(userId);
      if (record && record.attendance === 'present') {
        return record;
      }
      return {
        userId,
        attendance: 'absent',
        metaData: {
          autoMarked: true,
          duration: 0,
          joinTime: null,
          leaveTime: null,
        },
      };
    });
  }

  async getActiveAcademicYearId(
    tenantId: string,
    authToken: string,
  ): Promise<string | undefined> {
    const response = await this.httpService.axiosRef.post(
      `${this.userServiceUrl}/user/v1/academicyears/list`,
      { isActive: true },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          tenantid: tenantId,
          Authorization: authToken,
        },
      },
    );
    return response.data?.result?.[0]?.id;
  }

  async getCohortMemberIds(
    cohortId: string,
    tenantId: string,
    authToken: string,
  ): Promise<string[]> {
    const academicYearId = await this.getActiveAcademicYearId(
      tenantId,
      authToken,
    );

    const response = await this.httpService.axiosRef.post(
      `${this.userServiceUrl}/user/v1/cohortmember/list`,
      {
        limit: 1000,
        offset: 0,
        filters: {
          cohortId,
          academicYearIds: academicYearId ? [academicYearId] : [],
          status: ['active'],
          role: 'Learner',
        },
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          academicyearid: academicYearId,
          tenantid: tenantId,
          Authorization: authToken,
        },
      },
    );

    const userDetails = response.data?.result?.userDetails || [];
    return userDetails.map((member) => member.userId);
  }
}
