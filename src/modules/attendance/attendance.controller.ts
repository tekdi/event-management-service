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
import { MarkMeetingAttendanceDto, MarkAttendanceDto } from './dto/markAttendance.dto';
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
      markZoomAttendanceDto.pageSize,
    );
  }

  @UseFilters(new AllExceptionsFilter(API_ID.MARK_ATTENDANCE))
  @Post('/mark-attendance')
  @ApiBody({ type: MarkAttendanceDto })
  @UsePipes(new ValidationPipe({ transform: true }))
  async markAttendance(
    @Body() dto: MarkAttendanceDto,
    @Res() response: Response,
    @Req() request: Request,
    @GetUserId() userId: string,
  ): Promise<Response> {
    if (!request?.headers?.authorization) {
      throw new UnauthorizedException('Unauthorized');
    }
    
    const token = request.headers.authorization;
    return this.attendanceService.markAttendance(
      dto,
      userId,
      response,
      token
    );
  }


}
