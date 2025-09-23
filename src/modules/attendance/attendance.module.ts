import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EventAttendance } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { CheckpointService } from './checkpoint.service';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventRepetition } from '../event/entities/eventRepetition.entity';
import { EventAttendees } from '../attendees/entity/attendees.entity';
import { OnlineMeetingModule } from 'src/online-meeting-adapters/online-meeting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventRepetition, EventAttendees]),
    OnlineMeetingModule,
    HttpModule,
  ],
  controllers: [EventAttendance],
  providers: [AttendanceService, CheckpointService],
})
export class AttendanceModule {}
