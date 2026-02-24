import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRES_HOST'),
        port: configService.get('POSTGRES_PORT'),
        database: configService.get('POSTGRES_DATABASE'),
        username: configService.get('POSTGRES_USERNAME'),
        password: configService.get('POSTGRES_PASSWORD'),
        extra: {
          timezone: 'Z', // Use "Z" for UTC or your preferred timezone
          max: configService.get('DB_POOL_MAX', 100), // Maximum pool size
          min: configService.get('DB_POOL_MIN', 10), // Minimum pool size
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        },
        autoLoadEntities: true,
        logging: configService.get('NODE_ENV') !== 'production',
        // Query result caching
        cache: {
          duration: 30000, // 30 seconds
          type: 'database',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [ConfigService],
})
export class DatabaseModule {}
