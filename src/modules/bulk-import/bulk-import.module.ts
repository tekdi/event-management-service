import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { BulkImportService } from './bulk-import.service';
import { BulkImportController } from './bulk-import.controller';
import { AttendanceJob } from '../attendance/entities/attendance-job.entity';
import { EventAttendees } from '../attendees/entity/attendees.entity';
import { EventRepetition } from '../event/entities/eventRepetition.entity';
import { BulkImportProcessor } from './bulk-import.processor';
import { LmsModule } from '../lms/lms.module';
import { UserModule } from '../user/user.module';
import { KafkaModule } from '../../kafka/kafka.module';

import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [
    AttendanceModule,
    TypeOrmModule.forFeature([AttendanceJob, EventAttendees, EventRepetition]),
    BullModule.registerQueue({
      name: 'bulk-import',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    LmsModule,
    UserModule,
    KafkaModule,
  ],
  controllers: [BulkImportController],
  providers: [BulkImportService, BulkImportProcessor],
  exports: [BulkImportService],
})
export class BulkImportModule {}
