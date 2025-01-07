import { Injectable } from '@nestjs/common';
import { IOnlineMeetingLocator } from './onlineMeeting.locator';
import { ZoomService } from './zoom/zoom.adapter';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OnlineMeetingAdapter {
  private readonly adapterMap: Record<string, IOnlineMeetingLocator>;

  constructor(
    private readonly zoomProvider: ZoomService,
    private readonly configService: ConfigService,
  ) {
    this.adapterMap = {
      zoom: this.zoomProvider,
      // Add more adapters here
    };
  }

  getAdapter(): IOnlineMeetingLocator {
    const source = this.configService.get('ONLINE_MEETING_ADAPTER');
    const adapter = this.adapterMap[source];

    if (!adapter) {
      throw new Error(
        `Invalid online meeting adapter: '${source}'. Supported adapters: ${Object.keys(this.adapterMap).join(', ')}`,
      );
    }

    return adapter;
  }
}
