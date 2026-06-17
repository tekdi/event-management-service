import { Module } from '@nestjs/common';
import { OnlineMeetingAdapter } from './onlineMeeting.adapter';
import { ZoomService } from './zoom/zoom.adapter';
import { PathwayZoomService } from './zoom/pathway-zoom.adapter';
import { MockZoomService } from './mock/mock-zoom.adapter';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    {
      // useFactory bypasses NestJS DI for the second `prefix` constructor param
      provide: ZoomService,
      useFactory: (configService: ConfigService) => new ZoomService(configService, ''),
      inject: [ConfigService],
    },
    PathwayZoomService,
    OnlineMeetingAdapter,
    MockZoomService,
  ],
  exports: [OnlineMeetingAdapter, ZoomService, PathwayZoomService, MockZoomService],
})
export class OnlineMeetingModule {}
