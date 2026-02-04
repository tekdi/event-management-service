import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventReportController } from './event-report.controller';
import { EventReportService } from './event-report.service';
import { EventAttendees } from '../attendees/entity/attendees.entity';
import { Events } from '../event/entities/event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventAttendees, Events]),
    HttpModule,
  ],
  controllers: [EventReportController],
  providers: [EventReportService],
})
export class EventReportModule {}
