import { Module } from '@nestjs/common';
import { AttendeesController } from './attendees.controller';
import { AttendeesService } from './attendees.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventAttendees } from './entity/attendees.entity';
import { EventService } from '../event/event.service';
import { Events } from '../event/entities/event.entity';
import { CohortMember } from '../event/entities/CohortMembers.entity';
import { Cohort } from '../event/entities/Cohort.entity';
import { Users } from '../event/entities/Users.entity';
import { MeetingsService } from '../meetings/meetings.service';
import { ZoomMeetingAdapter } from '../meetings/adapter/zoom.adapter';
import { MeetingAdapterFactory } from '../meetings/meetingadapter';
import { MeetingsModule } from '../meetings/meetings.module';



@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventAttendees,
      Events,
      CohortMember,
      Cohort,
      Users
    ]),
    MeetingsModule
  ],
  controllers: [AttendeesController],
  providers: [AttendeesService, ConfigService, EventService, MeetingsService, ZoomMeetingAdapter, MeetingAdapterFactory]
})
export class AttendeesModule { }
