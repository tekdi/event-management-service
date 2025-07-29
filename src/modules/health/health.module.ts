import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { KafkaModule } from '../../kafka/kafka.module';

@Module({
  imports: [TypeOrmModule, KafkaModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
