import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventStorageController } from './event-storage.controller';

/**
 * CloudStorageService is created at runtime via useFactory so config is read
 * from ConfigService (after .env is loaded). Route always exists; 503 if not configured.
 */
@Module({
  imports: [ConfigModule],
  controllers: [EventStorageController],
  providers: [
    {
      provide: 'CloudStorageService',
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('CLOUD_STORAGE_PROVIDER');
        const region = configService.get<string>('CLOUD_STORAGE_REGION');
        const accessKeyId = configService.get<string>('CLOUD_STORAGE_ACCESS_KEY_ID');
        const secretAccessKey = configService.get<string>('CLOUD_STORAGE_SECRET_ACCESS_KEY');
        const bucket = configService.get<string>('CLOUD_STORAGE_BUCKET_NAME');
        if (!provider || !region || !accessKeyId || !secretAccessKey || !bucket) {
          return null;
        }
        try {
          const { AwsS3Service } = require('@tekdi/nestjs-cloud-storage');
          return new AwsS3Service({
            provider: provider as 'aws' | 'azure' | 'gcp',
            region,
            credentials: { accessKeyId, secretAccessKey },
            bucket,
          });
        } catch {
          return null;
        }
      },
      inject: [ConfigService],
    },
  ],
})
export class EventStorageModule {}
