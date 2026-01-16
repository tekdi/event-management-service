import { Injectable, Logger } from '@nestjs/common';
import { IOnlineMeetingLocator } from './onlineMeeting.locator';
import { ZoomService } from './zoom/zoom.adapter';
import { MockZoomService } from './mock/mock-zoom.adapter';
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
    private readonly mockZoomProvider: MockZoomService,
    private readonly configService: ConfigService,
  ) {
    this.initializeProviderRegistry();
  }

  private initializeProviderRegistry(): void {
    // Check if mock mode is enabled
    const useMockMode = this.configService.get<string>('USE_MOCK_ZOOM_ADAPTER') === 'true';
    
    // Register Zoom provider (real or mock based on config)
    if (useMockMode) {
      this.logger.log('Using Mock Zoom Adapter for testing');
      this.registerProvider('zoom', {
        name: 'Zoom (Mock)',
        adapter: this.mockZoomProvider,
        enabled: true,
      });
    } else {
    this.registerProvider('zoom', {
      name: 'Zoom',
      adapter: this.zoomProvider,
        enabled: true,
      });
    }

    // Also register mock as a separate provider option
    this.registerProvider('mock', {
      name: 'Mock Zoom',
      adapter: this.mockZoomProvider,
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

  /**
   * Get adapter with optional mock data file
   * If useMockData is true and mockDataFile is provided, returns mock adapter with file
   * Otherwise returns the configured adapter
   */
  getAdapterWithMockData(
    useMockData?: boolean,
    mockDataFile?: string,
  ): IOnlineMeetingLocator {
    if (useMockData && mockDataFile) {
      // Set the mock data file in the mock provider
      this.mockZoomProvider.setMockDataFile(mockDataFile);
      return this.mockZoomProvider;
    }
    return this.getAdapter();
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
