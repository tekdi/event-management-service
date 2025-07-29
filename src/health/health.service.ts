import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { KafkaService } from '../kafka/kafka.service';
import { v4 as uuidv4 } from 'uuid';

export interface HealthCheckResult {
  name: string;
  healthy: boolean;
}

export interface HealthResponse {
  id: string;
  ver: string;
  ts: string;
  params: {
    resmsgid: string;
    msgid: null;
    err: null;
    status: string;
    errmsg: null;
  };
  responseCode: string;
  result: {
    checks: HealthCheckResult[];
    healthy: boolean;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Optional()
    @InjectDataSource()
    private dataSource: DataSource,
    private kafkaService: KafkaService,
  ) {}

  async checkHealth(): Promise<HealthResponse> {
    const checks: HealthCheckResult[] = [];

    // Check PostgreSQL health
    const postgresqlHealthy = await this.checkPostgreSQL();
    checks.push({ name: 'postgresql', healthy: postgresqlHealthy });

    // Check Kafka health
    const kafkaHealthy = await this.checkKafka();
    checks.push({ name: 'kafka', healthy: kafkaHealthy });

    // Overall health is true if all checks pass
    const overallHealthy = checks.every((check) => check.healthy);

    const response: HealthResponse = {
      id: 'api.content.health',
      ver: '3.0',
      ts: new Date().toISOString(),
      params: {
        resmsgid: uuidv4(),
        msgid: null,
        err: null,
        status: 'successful',
        errmsg: null,
      },
      responseCode: 'OK',
      result: {
        checks,
        healthy: overallHealthy,
      },
    };

    this.logger.log(
      `Health check completed. Overall healthy: ${overallHealthy}`,
    );
    return response;
  }

  private async checkPostgreSQL(): Promise<boolean> {
    try {
      // Check if dataSource is available and initialized
      if (!this.dataSource) {
        this.logger.error('PostgreSQL DataSource is not available');
        return false;
      }

      if (!this.dataSource.isInitialized) {
        this.logger.error('PostgreSQL connection is not initialized');
        return false;
      }

      await this.dataSource.query('SELECT 1');
      this.logger.debug('PostgreSQL health check passed');
      return true;
    } catch (error) {
      this.logger.error(`PostgreSQL health check failed: ${error.message}`);
      return false;
    }
  }

  private async checkKafka(): Promise<boolean> {
    try {
      const healthy = await this.kafkaService.checkHealth();
      this.logger.debug(`Kafka health check result: ${healthy}`);
      return healthy;
    } catch (error) {
      this.logger.error(`Kafka health check failed: ${error.message}`);
      return false;
    }
  }
}
