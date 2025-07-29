import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

/**
 * Health Check Controller
 * 
 * Provides health check endpoint for the Event Management Service.
 * Due to the global prefix 'event-service' set in main.ts, this endpoint
 * is accessible at: GET /event-service/health
 * 
 * The health check validates:
 * - PostgreSQL database connectivity (via TypeORM SELECT 1 query)
 * - Kafka messaging system connectivity (via admin metadata fetch)
 * 
 * Returns response in format specified by requirements with ver: "3.0"
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Health Check Endpoint
   * 
   * @returns Health status of PostgreSQL and Kafka services
   * @endpoint GET /event-service/health
   */
  @Get()
  async checkHealth() {
    return this.healthService.checkHealth();
  }
}
