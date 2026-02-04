import {
  Controller,
  Post,
  Body,
  Headers,
  Res,
  UseFilters,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiBasicAuth,
  ApiOkResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { EventReportService } from './event-report.service';
import { EventAttendanceReportDto } from './dto/event-attendance-report.dto';
import { TenantOrg } from 'src/common/decorators/tenant-org.decorator';
import { AllExceptionsFilter } from 'src/common/filters/exception.filter';
import { API_ID } from 'src/common/utils/constants.util';
import { ERROR_MESSAGES } from 'src/common/utils/constants.util';

@Controller('reports')
@ApiTags('Event Reports')
@ApiBasicAuth('access-token')
export class EventReportController {
  constructor(private readonly eventReportService: EventReportService) {}

  @Post('attendance')
  @UseFilters(new AllExceptionsFilter(API_ID.GENERATE_EVENT_ATTENDANCE_REPORT))
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Generate event attendance report',
    description:
      'Generate report of users who attended specified events with aggregated event data. Pass eventIds and options in request body. Requires Authorization header for external API calls.',
  })
  @ApiOkResponse({
    description: 'Event attendance report generated successfully',
    status: 200,
  })
  @ApiInternalServerErrorResponse({
    description: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  })
  async generateEventAttendanceReport(
    @Body() reportDto: EventAttendanceReportDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
    @Headers('authorization') authorization: string,
    @Res() response: Response,
  ) {
    if (!authorization) {
      throw new BadRequestException('Authorization header is required');
    }

    if (!tenantOrg.tenantId || !tenantOrg.organisationId) {
      throw new BadRequestException(
        'tenantid and organisationid headers are required',
      );
    }

    return this.eventReportService.generateEventAttendanceReport(
      reportDto,
      tenantOrg.tenantId,
      tenantOrg.organisationId,
      authorization,
      response,
    );
  }
}
