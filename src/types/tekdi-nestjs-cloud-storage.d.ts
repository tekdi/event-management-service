declare module '@tekdi/nestjs-cloud-storage' {
  import { DynamicModule } from '@nestjs/common';

  export interface CloudStorageConfig {
    provider?: 'aws' | 'azure' | 'gcp';
    region?: string;
    credentials: {
      accessKeyId?: string;
      secretAccessKey?: string;
      [key: string]: unknown;
    };
    bucket?: string;
  }

  export class CloudStorageModule {
    static register(config: CloudStorageConfig): DynamicModule;
  }
}
