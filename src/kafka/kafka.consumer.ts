import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { LoggerWinston } from 'src/common/logger/logger.util';

@Injectable()
export class KafkaConsumerService implements OnModuleInit {
  private kafka: Kafka;
  private consumer: Consumer;
  private messageHandlers: Map<
    string,
    (payload: any) => Promise<void>
  > = new Map();

  constructor(private configService: ConfigService) {
    const brokers = this.configService.get<string>('KAFKA_BROKERS', 'localhost:9092').split(',');
    const clientId = this.configService.get<string>('KAFKA_CLIENT_ID', 'event-service');

    this.kafka = new Kafka({
      clientId,
      brokers,
    });

    this.consumer = this.kafka.consumer({
      groupId: `${clientId}-consumer-group`,
    });
  }

  async onModuleInit() {
    await this.consumer.connect();
    LoggerWinston.log('Kafka consumer connected');
  }

  async subscribe(topic: string, handler: (payload: any) => Promise<void>) {
    this.messageHandlers.set(topic, handler);
    await this.consumer.subscribe({ topic, fromBeginning: false });
    LoggerWinston.log(`Subscribed to topic: ${topic}`);
  }

  async startConsuming() {
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        const handler = this.messageHandlers.get(topic);
        if (handler) {
          try {
            const payload = JSON.parse(message.value?.toString() || '{}');
            await handler(payload);
            LoggerWinston.log(`Processed message from topic ${topic}`);
          } catch (error) {
            LoggerWinston.error(
              `Error processing message from topic ${topic}: ${error.message}`,
            );
          }
        }
      },
    });
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
    LoggerWinston.log('Kafka consumer disconnected');
  }
}
