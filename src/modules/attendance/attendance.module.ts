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
import { AttendanceQueueModule } from './attendance-queue.module';
import { AttendanceQueueService } from './attendance-queue.service';
import { AttendanceProcessor } from './attendance.processor';
import { AttendanceJobStatusService } from './attendance-job-status.service';
import { AttendanceJob } from './entities/attendance-job.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventRepetition, EventAttendees, AttendanceJob]),
    OnlineMeetingModule,
    HttpModule,
    AttendanceQueueModule,
  ],
  controllers: [EventAttendance],
  providers: [
    AttendanceService,
    CheckpointService,
    AttendanceQueueService,
    AttendanceProcessor,
    AttendanceJobStatusService,
  ],
})
export class AttendanceModule {}
