import { Body, Controller, Post, Res, Req, UseFilters } from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { AllExceptionsFilter } from '../../common/filters/exception.filter';
import { MarkZoomAttendanceDto } from './dto/MarkZoomAttendance.dto';
import { checkValidUserId } from '../../common/utils/functions.util';
import { API_ID, ERROR_MESSAGES } from '../../common/utils/constants.util';

@Controller('attendance/v1')
@ApiTags('Event-Attendance')
export class EventAttendance {
  constructor(private readonly attendanceService: AttendanceService) {}

  @UseFilters(new AllExceptionsFilter(API_ID.MARK_ZOOM_ATTENDANCE))
  @Post('/markeventattendance')
  @ApiBody({ type: MarkZoomAttendanceDto })
  @ApiQuery({
    name: 'userId',
    required: true,
    description: ERROR_MESSAGES.USERID_REQUIRED,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async markEventAttendance(
    @Body() markZoomAttendanceDto: MarkZoomAttendanceDto,
    @Res() response: Response,
    @Req() request: Request,
  ): Promise<Response> {
    const userId: string = checkValidUserId(request.query?.userId);
    return this.attendanceService.markAttendanceForZoomMeetingParticipants(
      markZoomAttendanceDto,
      userId,
      response,
    );
  }
}
