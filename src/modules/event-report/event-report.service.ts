import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { API_ID, ERROR_MESSAGES } from 'src/common/utils/constants.util';
import APIResponse from 'src/common/utils/response';
import { Repository } from 'typeorm';
import { EventAttendees } from '../attendees/entity/attendees.entity';
import { Events } from '../event/entities/event.entity';
import { EventAttendanceReportDto } from './dto/event-attendance-report.dto';

@Injectable()
export class EventReportService {
  private readonly logger = new Logger(EventReportService.name);

  constructor(
    @InjectRepository(EventAttendees)
    private readonly eventAttendeesRepository: Repository<EventAttendees>,
    @InjectRepository(Events)
    private readonly eventRepository: Repository<Events>,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async generateEventAttendanceReport(
    reportDto: EventAttendanceReportDto,
    tenantId: string,
    organisationId: string,
    authorization: string,
    response: Response,
  ): Promise<Response> {
    const apiId = API_ID.GENERATE_EVENT_ATTENDANCE_REPORT;
    const startTime = Date.now();

    try {
      await this.validateEvents(reportDto.eventIds);

      const { rows: queryResults, totalCount } =
        await this.getAttendanceAggregationWithCount(
          reportDto,
          tenantId,
          organisationId,
        );

      if (queryResults.length === 0) {
        return response.status(HttpStatus.OK).send(
          APIResponse.success(
            apiId,
            {
              data: [],
              totalElements: 0,
              offset: reportDto.offset ?? 0,
              limit: reportDto.limit ?? 10,
            },
            'No users found matching the criteria',
          ),
        );
      }

      const userIds = [...new Set(queryResults.map((r) => r.userId))].filter(
        Boolean,
      );

      if (userIds.length === 0) {
        return response.status(HttpStatus.OK).send(
          APIResponse.success(
            apiId,
            {
              data: [],
              totalElements: totalCount,
              offset: reportDto.offset ?? 0,
              limit: reportDto.limit ?? 10,
            },
            'No users found matching the criteria',
          ),
        );
      }

      const userDataMap = await this.fetchUserData(
        userIds,
        tenantId,
        organisationId,
        authorization,
      );

      const attended = reportDto.attended ?? true;
      const combinedData = this.combineUserAndEventData(
        queryResults,
        userDataMap,
        reportDto.sortBy || 'userId',
        reportDto.orderBy || 'asc',
        attended,
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `Event attendance report generated successfully. Found ${combinedData.length} users in ${duration}ms`,
      );

      return response.status(HttpStatus.OK).send(
        APIResponse.success(
          apiId,
          {
            data: combinedData,
            totalElements: totalCount,
            offset: reportDto.offset ?? 0,
            limit: reportDto.limit ?? 10,
          },
          'Event attendance report generated successfully',
        ),
      );
    } catch (error) {
      this.logger.error(
        `Event attendance report failed: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new BadRequestException(
        `Failed to generate event attendance report: ${error.message}`,
      );
    }
  }

  private getAttendanceFilterConfig(attended: boolean) {
    return {
      attendanceFilter: attended
        ? 'ea."isAttended" = TRUE'
        : '(ea."isAttended" = FALSE OR ea."isAttended" IS NULL)',
      eventIdsAggregation: attended
        ? `STRING_AGG(DISTINCT ea."eventId"::text, ', ') FILTER (WHERE ea."isAttended" = TRUE)`
        : `STRING_AGG(DISTINCT ea."eventId"::text, ', ') FILTER (WHERE (ea."isAttended" = FALSE OR ea."isAttended" IS NULL))`,
      titlesAggregation: attended
        ? `STRING_AGG(DISTINCT ed."title", ', ') FILTER (WHERE ea."isAttended" = TRUE)`
        : `STRING_AGG(DISTINCT ed."title", ', ') FILTER (WHERE (ea."isAttended" = FALSE OR ea."isAttended" IS NULL))`,
      durationAggregation: attended
        ? `COALESCE(SUM(ea."duration") FILTER (WHERE ea."isAttended" = TRUE), 0)`
        : `COALESCE(SUM(ea."duration") FILTER (WHERE (ea."isAttended" = FALSE OR ea."isAttended" IS NULL)), 0)`,
      havingClause: attended
        ? `HAVING COUNT(*) FILTER (WHERE ea."isAttended" = TRUE) >= 1`
        : `HAVING COUNT(*) FILTER (WHERE (ea."isAttended" = FALSE OR ea."isAttended" IS NULL)) >= 1`,
    };
  }

  private async validateEvents(eventIds: string[]): Promise<void> {
    const events = await this.eventRepository
      .createQueryBuilder('e')
      .innerJoin('EventDetails', 'ed', 'e.eventDetailId = ed.eventDetailId')
      .where('e.eventId IN (:...eventIds)', { eventIds })
      .andWhere('ed.status != :archivedStatus', { archivedStatus: 'archived' })
      .getMany();

    if (events.length === 0) {
      throw new NotFoundException(
        ERROR_MESSAGES.EVENT_NOT_FOUND ||
          'No events found for the provided eventIds or all events are archived',
      );
    }

    if (events.length !== eventIds.length) {
      const foundEventIds = new Set(events.map((e) => e.eventId));
      const missingEventIds = eventIds.filter((id) => !foundEventIds.has(id));
      throw new NotFoundException(
        `Some events not found or archived: ${missingEventIds.join(', ')}`,
      );
    }
  }

  private async getAttendanceAggregationWithCount(
    reportDto: EventAttendanceReportDto,
    _tenantId: string,
    _organisationId: string,
  ): Promise<{ rows: any[]; totalCount: number }> {
    try {
      const offset = reportDto.offset ?? 0;
      const limit = reportDto.limit ?? 10;
      const sortBy = reportDto.sortBy || 'userId';
      const orderBy = (reportDto.orderBy || 'asc').toUpperCase();
      const attended = reportDto.attended ?? true;
      const filterConfig = this.getAttendanceFilterConfig(attended);
      const eventIds = Array.isArray(reportDto.eventIds)
        ? [...reportDto.eventIds]
        : [];
      const eventCount = eventIds.length;

      const eventIdPlaceholders = eventIds
        .map((_, i) => `$${i + 1}::uuid`)
        .join(', ');
      const paramLimit = eventCount + 1;
      const paramOffset = eventCount + 2;

      let orderByClause = '';
      switch (sortBy) {
        case 'userId':
          orderByClause = `ORDER BY "userId" ${orderBy}`;
          break;
        case 'firstName':
        case 'lastName':
          orderByClause = `ORDER BY "userId" ASC`;
          break;
        default:
          orderByClause = `ORDER BY "userId" ${orderBy}`;
      }

      const query = `
        WITH aggregated AS (
          SELECT
            ea."userId" AS "userId",
            ${filterConfig.eventIdsAggregation} AS "event_ids",
            ${filterConfig.titlesAggregation} AS "titles",
            ${filterConfig.durationAggregation} AS "duration",
            COUNT(*) OVER() AS "total_count"
          FROM "EventAttendees" ea
          INNER JOIN "Events" e ON ea."eventId" = e."eventId"
          INNER JOIN "EventDetails" ed ON e."eventDetailId" = ed."eventDetailId"
          WHERE ea."eventId" IN (${eventIdPlaceholders})
            AND ed."status" != 'archived'
            AND ${filterConfig.attendanceFilter}
          GROUP BY ea."userId"
          ${filterConfig.havingClause}
        )
        SELECT "userId", "event_ids", "titles", "duration", "total_count"
        FROM aggregated
        ${orderByClause}
        LIMIT $${paramLimit} OFFSET $${paramOffset}
      `;

      const params = [...eventIds, limit, offset];
      const result = await this.eventAttendeesRepository.query(query, params);
      const totalCount = result.length > 0 ? Number(result[0].total_count) : 0;

      return {
        rows: result.map((r: any) => ({
          userId: r.userId,
          event_ids: r.event_ids,
          titles: r.titles,
          duration: Number(r.duration ?? 0),
        })),
        totalCount,
      };
    } catch (error) {
      this.logger.error(
        `Attendance aggregation query failed: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Database query failed: ${error.message}`);
    }
  }

  private async fetchUserData(
    userIds: string[],
    tenantId: string,
    organisationId: string,
    authorization: string,
  ): Promise<Map<string, any>> {
    try {
      const userServiceUrl = this.configService.get('USER_SERVICE');

      if (!userServiceUrl) {
        throw new BadRequestException('USER_SERVICE not configured');
      }

      if (!userIds?.length) {
        return new Map();
      }

      const response = await this.httpService.axiosRef.post(
        `${userServiceUrl}/user/v1/list`,
        {
          filters: { userId: userIds },
          limit: userIds.length,
          offset: 0,
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(authorization && { Authorization: authorization }),
            tenantid: tenantId,
            organisationid: organisationId,
          },
        },
      );

      // Handle different response structures
      let userDetails: any[] = [];
      if (response.data?.result?.getUserDetails) {
        userDetails = response.data.result.getUserDetails;
      } else if (Array.isArray(response.data?.result)) {
        userDetails = response.data.result;
      } else if (Array.isArray(response.data)) {
        userDetails = response.data;
      } else if (Array.isArray(response.data?.data)) {
        userDetails = response.data.data;
      } else {
        userDetails = [];
      }

      const userMap = new Map<string, any>();
      (Array.isArray(userDetails) ? userDetails : []).forEach((user: any) => {
        if (user?.userId) {
          const {
            createdBy,
            updatedBy,
            createdAt,
            updatedAt,
            ...userWithoutAudit
          } = user;
          userMap.set(user.userId, userWithoutAudit);
        }
      });

      return userMap;
    } catch (error) {
      this.logger.error(
        `Failed to fetch user data from external API: ${error.message}`,
        {
          status: error.response?.status,
          response: error.response?.data,
        },
      );

      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to fetch user data from user service';

      throw new BadRequestException(
        'User service error: ' +
          errorMessage +
          (error.response?.status
            ? ' (Status: ' + error.response.status + ')'
            : ''),
      );
    }
  }

  private combineUserAndEventData(
    queryResults: any[],
    userDataMap: Map<string, any>,
    sortBy: string,
    orderBy: string,
    attended: boolean,
  ): any[] {
    const combined = queryResults.map((result) => {
      const userData = userDataMap.get(result.userId) ?? {};
      return {
        userId: result.userId,
        firstName: userData.firstName ?? null,
        lastName: userData.lastName ?? null,
        email: userData.email ?? null,
        event_ids: result.event_ids ?? '',
        titles: result.titles ?? '',
        attended,
        duration: result.duration ?? 0,
      };
    });

    if (sortBy === 'firstName' || sortBy === 'lastName') {
      combined.sort((a, b) => {
        const aValue = (a[sortBy] || '').toLowerCase();
        const bValue = (b[sortBy] || '').toLowerCase();
        const comparison = aValue.localeCompare(bValue);
        return orderBy === 'desc' ? -comparison : comparison;
      });
    }

    return combined;
  }
}
