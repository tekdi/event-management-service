import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import APIResponse from 'src/common/utils/response';

@Controller('attendance/v1')
@ApiTags('Event-Attendance')
export class EventAttendance {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('/:zoommeetid')
  async markEventAttendance(
    @Param('zoommeetid') zoomMeetingId: string,
    @Res() response: Response,
    @Req() request: Request,
  ): Promise<Response> {
    const apiId = 'mark.event.attendance';
    try {
      return this.attendanceService.markAttendanceForZoomMeetingParticipants(
        zoomMeetingId,
        response,
      );
    } catch (e) {
      return response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(
          APIResponse.error(
            apiId,
            'Something went wrong',
            JSON.stringify(e),
            'INTERNAL_SERVER_ERROR',
          ),
        );
    }
  }
}
