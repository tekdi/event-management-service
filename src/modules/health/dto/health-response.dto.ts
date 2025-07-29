import { ApiProperty } from '@nestjs/swagger';

export class HealthCheckDto {
  @ApiProperty({ example: 'postgresql', description: 'Name of the service being checked' })
  name: string;

  @ApiProperty({ example: true, description: 'Whether the service is healthy' })
  healthy: boolean;
}

export class HealthResponseDto {
  @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Timestamp of the health check' })
  time: string;

  @ApiProperty({ example: 'abc123-def456-ghi789', description: 'Unique response message ID' })
  resmsgid: string;

  @ApiProperty({ example: 'healthy', enum: ['healthy', 'unhealthy'], description: 'Overall system status' })
  status: 'healthy' | 'unhealthy';

  @ApiProperty({ type: [HealthCheckDto], description: 'Individual health check results' })
  checks: HealthCheckDto[];
}