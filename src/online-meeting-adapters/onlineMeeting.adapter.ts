import { Injectable } from '@nestjs/common';
import { IOnlineMeetingLocator } from './onlineMeeting.locator';
import { ZoomService } from './zoom/zoom.adapter';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OnlineMeetingAdapter {
  private adapterMap: Record<string, IOnlineMeetingLocator>;

  constructor(
    private zoomProvider: ZoomService,
    private readonly configService: ConfigService,
  ) {
    this.adapterMap = {
      zoom: this.zoomProvider,
    };
  }

  getAdapter(): IOnlineMeetingLocator {
    const source = this.configService.get('ONLINE_MEETING_ADAPTER'); // Default to 'postgres' if undefined
    const adapter = this.adapterMap[source];

    if (!adapter) {
      throw new Error(`Invalid adapter source: ${source}`);
    }

    return adapter;
  }
}
