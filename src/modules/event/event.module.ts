import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Events } from './entities/event.entity';
import { EventDetail } from './entities/eventDetail.entity';
import { EventRepetition } from './entities/eventRepetition.entity';
import { TypeormService } from 'src/common/services/typeorm.service';

@Module({
  imports: [TypeOrmModule.forFeature([Events, EventDetail, EventRepetition])],
  controllers: [EventController],
  providers: [EventService, ConfigService, TypeormService],
})
export class EventModule {}
