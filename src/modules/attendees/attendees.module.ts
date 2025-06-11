import { Module, forwardRef } from '@nestjs/common';
import { AttendeesController } from './attendees.controller';
import { AttendeesService } from './attendees.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventAttendees } from './entity/attendees.entity';
import { EventService } from '../event/event.service';
import { Events } from '../event/entities/event.entity';
import { EventDetail } from '../event/entities/eventDetail.entity';
import { EventRepetition } from '../event/entities/eventRepetition.entity';
import { KafkaModule } from 'src/kafka/kafka.module';
import { EventModule } from '../event/event.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventAttendees,
      Events,
      EventDetail,
      EventRepetition,
    ]),
    KafkaModule,
    forwardRef(() => EventModule),
  ],
  controllers: [AttendeesController],
  providers: [AttendeesService],
  exports: [AttendeesService],
})
export class AttendeesModule {}
