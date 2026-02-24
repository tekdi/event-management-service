import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaService } from './kafka.service';
import { KafkaConsumerService } from './kafka.consumer';

@Module({
  imports: [ConfigModule],
  providers: [KafkaService, KafkaConsumerService],
  exports: [KafkaService, KafkaConsumerService],
})
export class KafkaModule {} 