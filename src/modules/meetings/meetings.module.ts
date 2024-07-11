import { Module } from '@nestjs/common';
import { MeetingsController } from './meetings.controller';
import { MeetingAdapterFactory } from './meetingadapter';
import { ZoomMeetingAdapter } from './adapter/zoom.adapter';
import { MeetingsService } from './meetings.service';
import { EventService } from '../event/event.service';
import { Events } from '../event/entities/event.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from '../event/event.module';
import { CohortMember } from '../event/entities/CohortMembers.entity';
import { Cohort } from '../event/entities/Cohort.entity';
import { Users } from '../event/entities/Users.entity';
import { AttendeesService } from '../attendees/attendees.service';
import { EventAttendees } from '../attendees/entity/attendees.entity';



@Module({
  imports: [
    TypeOrmModule.forFeature([
      Events,
      CohortMember,
      Cohort,
      Users,
      EventAttendees
    ]),
    EventModule
  ],

  providers: [MeetingAdapterFactory, ZoomMeetingAdapter, MeetingsService, EventService, AttendeesService],
  controllers: [MeetingsController]
})
export class MeetingsModule { }
