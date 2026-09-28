import { Injectable, Logger } from '@nestjs/common';
import { IOnlineMeetingLocator } from './onlineMeeting.locator';
import { ZoomService } from './zoom/zoom.adapter';
import { PathwayZoomService } from './zoom/pathway-zoom.adapter';
import { MockZoomService } from './mock/mock-zoom.adapter';
import { ConfigService } from '@nestjs/config';
import { MeetingType } from 'src/common/utils/types';

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
    private readonly pathwayZoomProvider: PathwayZoomService,
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
      this.registerProvider('pathway-zoom', {
        name: 'Pathway Zoom (Mock)',
        adapter: this.mockZoomProvider,
        enabled: true,
      });
    } else {
      this.registerProvider('zoom', {
        name: 'Zoom',
        adapter: this.zoomProvider,
        enabled: true,
      });
      this.registerProvider('pathway-zoom', {
        name: 'Pathway Zoom',
        adapter: this.pathwayZoomProvider,
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

  getPathwayAdapter(): IOnlineMeetingLocator {
    return this.getProvider('pathway-zoom');
  }

  /**
   * Resolves which Zoom account a given event belongs to.
   *
   * - Non-pathway events always use the main Zoom account (unchanged behaviour).
   * - Pathway events use the main Zoom account for webinars, because the webinar
   *   licence lives on that account.
   * - Pathway events use the dedicated Pathway Zoom account for meetings.
   *
   * The rule is deterministic from (isPathway, meetingType), so create, update,
   * delete, registrant and attendance calls all resolve to the same account.
   */
  getAdapterFor(
    isPathway: boolean,
    meetingType: MeetingType | string = MeetingType.meeting,
    context = '',
  ): IOnlineMeetingLocator {
    const usePathwayAccount = isPathway && meetingType !== MeetingType.webinar;
    const adapter = usePathwayAccount
      ? this.getPathwayAdapter()
      : this.getAdapter();

    this.logger.log(
      `[ZOOM ACCOUNT]${context ? ` [${context}]` : ''} ` +
        `isPathway=${isPathway} meetingType=${meetingType} => ` +
        `${usePathwayAccount ? 'NEW (PATHWAY) ACCOUNT SELECTED' : 'MAIN ACCOUNT SELECTED'}`,
    );

    return adapter;
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
