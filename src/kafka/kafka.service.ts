import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, Partitioners } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly isKafkaEnabled: boolean;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {
    this.isKafkaEnabled = this.configService.get<boolean>('KAFKA_ENABLED', true);
    const brokers = this.configService.get<string>('KAFKA_BROKERS', 'localhost:9092').split(',');
    const clientId = this.configService.get<string>('KAFKA_CLIENT_ID', 'event-management-service');

    if (this.isKafkaEnabled) {
      this.kafka = new Kafka({
        clientId,
        brokers,
      });
      this.producer = this.kafka.producer({
        createPartitioner: Partitioners.LegacyPartitioner,
      });
    }
  }

  async onModuleInit() {
    if (this.isKafkaEnabled) {
      try {
        await this.producer.connect();
        this.isConnected = true;
        this.logger.log('Kafka producer connected successfully');
      } catch (error) {
        this.logger.error('Failed to connect Kafka producer. Disabling Kafka for this instance.', error);
        this.isConnected = false;
      }
    }
  }

  async onModuleDestroy() {
    if (this.isKafkaEnabled && this.producer) {
      await this.producer.disconnect();
    }
  }

  async publishMessage(topic: string, message: any, key?: string): Promise<void> {
    if (!this.isKafkaEnabled || !this.isConnected) return;

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key,
            value: typeof message === 'string' ? message : JSON.stringify(message),
          },
        ],
      });
    } catch (error) {
      this.logger.error(`Failed to publish message to topic ${topic}`, error);
      throw error;
    }
  }
}
