import { Module } from '@nestjs/common';
import { EventAttendance } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [HttpModule],
  controllers: [EventAttendance],
  providers: [AttendanceService, ConfigService],
})
export class AttendanceModule {}
