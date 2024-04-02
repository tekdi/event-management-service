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
import { Users } from './entities/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Events, EventAttendees, Users])],
  controllers: [EventController],
  providers: [EventService, ConfigService, AttendeesService],
})
export class EventModule {}
