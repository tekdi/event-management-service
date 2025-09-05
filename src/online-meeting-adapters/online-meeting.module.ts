import { Module } from '@nestjs/common';
import { OnlineMeetingAdapter } from './onlineMeeting.adapter';
import { ZoomService } from './zoom/zoom.adapter';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [OnlineMeetingAdapter, ZoomService],
  exports: [OnlineMeetingAdapter, ZoomService],
})
export class OnlineMeetingModule {}
