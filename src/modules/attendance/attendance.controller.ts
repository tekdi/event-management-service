import {
  Body,
  Controller,
  Post,
  Res,
  Req,
  UseFilters,
  UsePipes,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiBasicAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { AllExceptionsFilter } from 'src/common/filters/exception.filter';
import {
  MarkMeetingAttendanceDto,
  MarkAttendanceByUsernameDto,
} from './dto/markAttendance.dto';
import { API_ID } from 'src/common/utils/constants.util';
import { GetUserId } from 'src/common/decorators/userId.decorator';

@Controller('attendance/v1')
@ApiTags('Event-Attendance')
@ApiBasicAuth('access-token')
export class EventAttendance {
  constructor(private readonly attendanceService: AttendanceService) {}

  @UseFilters(new AllExceptionsFilter(API_ID.MARK_EVENT_ATTENDANCE))
  @Post('/markeventattendance')
  @ApiBody({ type: MarkMeetingAttendanceDto })
  @UsePipes(new ValidationPipe({ transform: true }))
  async markEventAttendance(
    @Body() markZoomAttendanceDto: MarkMeetingAttendanceDto,
    @Res() response: Response,
    @Req() request: Request,
    @GetUserId() userId: string,
  ): Promise<Response> {
    if (!request?.headers?.authorization) {
      throw new UnauthorizedException('Unauthorized');
    }
    const token = request.headers.authorization;
    return this.attendanceService.markAttendanceForMeetingParticipants(
      markZoomAttendanceDto,
      userId,
      response,
      token,
    );
  }

  /**
   * Mark attendance for a meeting participants
   * seach ended events for attendance marking and whose attendance is not marked and mark attendance for them
   * @param response - Response object
   * @param request - Request object
   * @param userId - User ID
   * @returns Response object
   */
  @UseFilters(new AllExceptionsFilter(API_ID.MARK_ATTENDANCE))
  @Post('/mark-attendance')
  @UsePipes(new ValidationPipe({ transform: true }))
  async markAttendance(
    @Res() response: Response,
    @Req() request: Request,
    @GetUserId() userId: string,
  ): Promise<Response> {
    if (!request?.headers?.authorization) {
      throw new UnauthorizedException('Unauthorized');
    }
    const token = request.headers.authorization;
    return this.attendanceService.markAttendance(userId, response, token);
  }

  /**
   * Mark attendance by userId directly (without Zoom API)
   * This API is designed for Postman runner testing and manual attendance marking
   * It skips Zoom API calls and User Service lookup, directly processes userIds to mark attendance
   * 
   * @param markAttendanceByUsernameDto - DTO containing userIds and event details
   * @param response - Response object
   * @param request - Request object
   * @param userId - User ID of the person marking attendance
   * @returns Response object with attendance marking results
   */
  @UseFilters(new AllExceptionsFilter(API_ID.MARK_ATTENDANCE_BY_USERNAME))
  @Post('/mark-attendance-by-userId')
  @ApiBody({ type: MarkAttendanceByUsernameDto })
  @UsePipes(new ValidationPipe({ transform: true }))
  async markAttendanceByUserId(
    @Body() markAttendanceByUsernameDto: MarkAttendanceByUsernameDto,
    @Res() response: Response,
    @Req() request: Request,
    @GetUserId() userId: string,
  ): Promise<Response> {
    if (!request?.headers?.authorization) {
      throw new UnauthorizedException('Unauthorized');
    }
    const token = request.headers.authorization;
    return this.attendanceService.markAttendanceByUserId(
      markAttendanceByUsernameDto,
      userId,
      response,
      token,
    );
  }
}
