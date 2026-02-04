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
import { HealthModule } from './health/health.module';
import { EventReportModule } from './modules/event-report/event-report.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventModule,
    DatabaseModule,
    AttendeesModule,
    AttendanceModule,
    RolePermissionModule,
    HealthModule,
    EventReportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PermissionMiddleware).forRoutes('*'); // Apply middleware to the all routes
  }
}
