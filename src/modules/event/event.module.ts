import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
// import { HasuraService } from 'src/services/hasura/hasura.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
// import { AxiosRequest } from 'src/common/middleware/axios.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Events } from './entities/event.entity';
import { AttendeesService } from '../attendees/attendees.service';
import { EventAttendees } from '../attendees/entity/attendees.entity';
import { CohortMember } from './entities/CohortMembers.entity';
import { Cohort } from './entities/Cohort.entity';
import { Users } from './entities/Users.entity';
import { MeetingsService } from '../meetings/meetings.service';
import { MeetingAdapterFactory } from '../meetings/meetingadapter';
import { ZoomMeetingAdapter } from '../meetings/adapter/zoom.adapter';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Events,
      CohortMember,
      EventAttendees,
      Cohort,
      Users
    ])
  ],
  controllers: [EventController],
  providers: [EventService, ConfigService, AttendeesService, MeetingsService, MeetingAdapterFactory, ZoomMeetingAdapter],
})
export class EventModule { }
