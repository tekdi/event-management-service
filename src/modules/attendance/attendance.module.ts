import { Module } from '@nestjs/common';
import { EventAttendance } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { OnlineMeetingAdapter } from '../../online-meeting-adapters/onlineMeeting.adapter';
import { ZoomService } from '../../online-meeting-adapters/zoom/zoom.adapter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventRepetition } from '../event/entities/eventRepetition.entity';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([EventRepetition])],
  controllers: [EventAttendance],
  providers: [
    AttendanceService,
    ConfigService,
    OnlineMeetingAdapter,
    ZoomService,
  ],
})
export class AttendanceModule {}
