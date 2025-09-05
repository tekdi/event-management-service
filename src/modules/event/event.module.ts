import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Events } from './entities/event.entity';
import { EventDetail } from './entities/eventDetail.entity';
import { EventAttendees } from '../attendees/entity/attendees.entity';
import { EventRepetition } from './entities/eventRepetition.entity';
import { OnlineMeetingModule } from 'src/online-meeting-adapters/online-meeting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Events,
      EventAttendees,
      EventDetail,
      EventRepetition,
    ]),
    OnlineMeetingModule,
  ],
  controllers: [EventController],
  providers: [EventService],
})
export class EventModule {}
