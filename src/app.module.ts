import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventModule } from './modules/event/event.module';
import { DatabaseModule } from './common/database-modules';
import { AttendeesModule } from './modules/attendees/attendees.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { PermissionMiddleware } from './middleware/permission.middleware';
import { RolePermissionModule } from './modules/permissionRbac/rolePermissionMapping/role-permission.module';
import { KafkaModule } from './kafka/kafka.module';
import kafkaConfig from './kafka/kafka.config';
import { RedisCacheModule } from './cache/cache.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { CircuitBreakerModule } from './common/circuit-breaker/circuit-breaker.module';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ConfigModule.forRoot({
      load: [kafkaConfig], // Load the Kafka config
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute per IP
      },
    ]),
    DatabaseModule,
    RedisCacheModule,
    CircuitBreakerModule,
    EventModule,
    AttendeesModule,
    AttendanceModule,
    RolePermissionModule,
    KafkaModule,
    HealthModule,
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PermissionMiddleware).forRoutes('*'); // Apply middleware to the all routes
  }
}
