import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { KafkaService } from '../../kafka/kafka.service';
import { HealthCheckDto, HealthResponseDto } from './dto/health-response.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly kafkaService: KafkaService,
  ) {}

  async getHealthStatus(): Promise<HealthResponseDto> {
    const checks: HealthCheckDto[] = [];
    
    // Check PostgreSQL health
    const postgresqlHealth = await this.checkPostgreSQLHealth();
    checks.push({
      name: 'postgresql',
      healthy: postgresqlHealth,
    });

    // Check Kafka health
    const kafkaHealth = await this.checkKafkaHealth();
    checks.push({
      name: 'kafka',
      healthy: kafkaHealth,
    });

    // Determine overall status
    const overallStatus = checks.every(check => check.healthy) ? 'healthy' : 'unhealthy';

    return {
      time: new Date().toISOString(),
      resmsgid: randomBytes(16).toString('hex'),
      status: overallStatus,
      checks,
    };
  }

  private async checkPostgreSQLHealth(): Promise<boolean> {
    try {
      // Perform a simple query to check database connectivity
      await this.dataSource.query('SELECT 1');
      this.logger.debug('PostgreSQL health check passed');
      return true;
    } catch (error) {
      this.logger.error('PostgreSQL health check failed', error);
      return false;
    }
  }

  private async checkKafkaHealth(): Promise<boolean> {
    try {
      return await this.kafkaService.healthCheck();
    } catch (error) {
      this.logger.error('Kafka health check failed', error);
      return false;
    }
  }
}