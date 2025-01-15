import {
  Body,
  Controller,
  Post,
  Res,
  Req,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { AllExceptionsFilter } from '../../common/filters/exception.filter';
import { MarkMeetingAttendanceDto } from './dto/MarkAttendance.dto';
import { checkValidUserId } from '../../common/utils/functions.util';
import { API_ID, ERROR_MESSAGES } from '../../common/utils/constants.util';

@Controller('attendance/v1')
@ApiTags('Event-Attendance')
export class EventAttendance {
  constructor(private readonly attendanceService: AttendanceService) {}

  @UseFilters(new AllExceptionsFilter(API_ID.MARK_EVENT_ATTENDANCE))
  @Post('/markeventattendance')
  @ApiBody({ type: MarkMeetingAttendanceDto })
  @ApiQuery({
    name: 'userId',
    required: true,
    description: ERROR_MESSAGES.USERID_REQUIRED,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async markEventAttendance(
    @Body() markZoomAttendanceDto: MarkMeetingAttendanceDto,
    @Res() response: Response,
    @Req() request: Request,
  ): Promise<Response> {
    const userId: string = checkValidUserId(request.query?.userId);
    return this.attendanceService.markAttendanceForMeetingParticipants(
      markZoomAttendanceDto,
      userId,
      response,
    );
  }
}
