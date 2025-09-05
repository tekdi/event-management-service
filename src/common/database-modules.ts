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
        },
        // entities: [
        //   User
        // ],
        autoLoadEntities: true,
        synchronize: true
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [ConfigService],
})
export class DatabaseModule {}
