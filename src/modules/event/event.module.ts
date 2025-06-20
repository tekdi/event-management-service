import { Module, forwardRef } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Events } from './entities/event.entity';
import { EventDetail } from './entities/eventDetail.entity';
import { AttendeesService } from '../attendees/attendees.service';
import { EventAttendees } from '../attendees/entity/attendees.entity';
import { EventRepetition } from './entities/eventRepetition.entity';
import { KafkaModule } from 'src/kafka/kafka.module';
import { AttendeesModule } from '../attendees/attendees.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Events,
      EventAttendees,
      EventDetail,
      EventRepetition,
    ]),
    KafkaModule,
    forwardRef(() => AttendeesModule),
  ],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}
