import { Injectable, Logger } from '@nestjs/common';
import { IOnlineMeetingLocator } from './onlineMeeting.locator';
import { ZoomService } from './zoom/zoom.adapter';
import { ConfigService } from '@nestjs/config';

export interface ProviderConfig {
  name: string;
  adapter: IOnlineMeetingLocator;
  enabled: boolean;
}

@Injectable()
export class OnlineMeetingAdapter {
  private readonly logger = new Logger(OnlineMeetingAdapter.name);
  private readonly providerRegistry: Map<string, ProviderConfig> = new Map();

  constructor(
    private readonly zoomProvider: ZoomService,
    private readonly configService: ConfigService,
  ) {
    this.initializeProviderRegistry();
  }

  private initializeProviderRegistry(): void {
    // Register Zoom provider
    this.registerProvider('zoom', {
      name: 'Zoom',
      adapter: this.zoomProvider,
      enabled: true,
    });

    // Future providers can be registered here
    // this.registerProvider('googlemeet', {
    //   name: 'Google Meet',
    //   adapter: this.googleMeetProvider,
    //   enabled: true,
    // });

    // this.registerProvider('microsoftteams', {
    //   name: 'Microsoft Teams',
    //   adapter: this.microsoftTeamsProvider,
    //   enabled: true,
    // });

    this.logger.log(
      `Initialized provider registry with ${this.providerRegistry.size} providers`,
    );
  }

  registerProvider(key: string, config: ProviderConfig): void {
    this.providerRegistry.set(key.toLowerCase(), config);
    this.logger.log(`Registered provider: ${config.name} (${key})`);
  }

  getProvider(key: string): IOnlineMeetingLocator {
    const provider = this.providerRegistry.get(key.toLowerCase());

    if (!provider) {
      const availableProviders = Array.from(this.providerRegistry.keys()).join(
        ', ',
      );
      throw new Error(
        `Provider '${key}' not found. Available providers: ${availableProviders}`,
      );
    }

    if (!provider.enabled) {
      throw new Error(`Provider '${provider.name}' is currently disabled`);
    }

    return provider.adapter;
  }

  getAdapter(): IOnlineMeetingLocator {
    const source = this.configService.get('ONLINE_MEETING_ADAPTER');
    return this.getProvider(source);
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providerRegistry.keys());
  }

  getProviderInfo(key: string): ProviderConfig | null {
    return this.providerRegistry.get(key.toLowerCase()) || null;
  }

  isProviderEnabled(key: string): boolean {
    const provider = this.providerRegistry.get(key.toLowerCase());
    return provider?.enabled || false;
  }
}
