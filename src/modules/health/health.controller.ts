import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthResponseDto } from './dto/health-response.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({
    status: 200,
    description: 'Health check results',
    type: HealthResponseDto,
  })
  async getHealth(): Promise<HealthResponseDto> {
    return this.healthService.getHealthStatus();
  }
}