import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventModule } from './modules/event/event.module';
import { DatabaseModule } from './common/database-modules';
import { AttendeesModule } from './modules/attendees/attendees.module';
import { MeetingsModule } from './modules/meetings/meetings.module';


@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), EventModule, DatabaseModule, AttendeesModule, MeetingsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
