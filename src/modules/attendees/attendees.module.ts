import { Module } from '@nestjs/common';
import { AttendeesController } from './attendees.controller';
import { AttendeesService } from './attendees.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventAttendees } from './entity/attendees.entity';
import { EventService } from '../event/event.service';
import { Events } from '../event/entities/event.entity';
import { EventDetail } from '../event/entities/eventDetail.entity';
import { EventRepetition } from '../event/entities/eventRepetition.entity';
import { OnlineMeetingModule } from 'src/online-meeting-adapters/online-meeting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventAttendees,
      Events,
      EventDetail,
      EventRepetition,
    ]),
    OnlineMeetingModule,
  ],
  controllers: [AttendeesController],
  providers: [AttendeesService, EventService],
})
export class AttendeesModule {}
