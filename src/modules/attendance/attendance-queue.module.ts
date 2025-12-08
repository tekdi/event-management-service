import { Module, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('AttendanceQueueModule');
        try {
          const connection = {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
            password: configService.get<string>('REDIS_PASSWORD'),
            db: configService.get<number>('REDIS_DB', 0),
            // Lazy connect - don't connect immediately, only when needed
            lazyConnect: true,
            // Add connection retry and error handling
            retryStrategy: (times: number) => {
              if (times > 3) {
                logger.warn('Redis connection failed after 3 attempts. Worker will not start.');
                return null; // Stop retrying
              }
              return Math.min(times * 200, 2000);
            },
            maxRetriesPerRequest: null, // Don't fail on Redis errors
          };
          return { connection };
        } catch (error) {
          const logger = new Logger('AttendanceQueueModule');
          logger.warn(`Failed to configure Redis connection: ${error.message}. Worker will not be available.`);
          // Return a dummy connection config to allow app to start
          return {
            connection: {
              host: 'localhost',
              port: 6379,
              lazyConnect: true, // Don't connect immediately
            },
          };
        }
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'attendance',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    }),
  ],
  exports: [BullModule],
})
export class AttendanceQueueModule {
  private readonly logger = new Logger(AttendanceQueueModule.name);

  constructor() {
    // Log module initialization
    this.logger.log('AttendanceQueueModule initialized');
  }
}

