import { Module } from '@nestjs/common';
import { EventAttendance } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { OnlineMeetingAdapter } from 'src/online-meeting-adapters/onlineMeeting.adapter';
import { ZoomService } from 'src/online-meeting-adapters/zoom/zoom.adapter';

@Module({
  imports: [HttpModule],
  controllers: [EventAttendance],
  providers: [
    AttendanceService,
    ConfigService,
    OnlineMeetingAdapter,
    ZoomService,
  ],
})
export class AttendanceModule {}
