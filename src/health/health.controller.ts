import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Response } from 'express';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check service health and database connection (readiness probe)' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy and database is connected',
  })
  @ApiResponse({
    status: 503,
    description: 'Service is unhealthy or database is not connected',
  })
  async check(@Res() response: Response) {
    const dbStatus = await this.checkDatabaseDirectly();
    
    if (!dbStatus.connected) {
      const errorResponse = {
        status: 'error',
        info: {},
        error: {
          database: {
            status: 'down',
            message: dbStatus.message || 'Database connection failed',
          },
        },
        details: {
          database: {
            status: 'down',
            message: dbStatus.message || 'Database connection failed',
          },
        },
      };
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json(errorResponse);
    }

    const successResponse = {
      status: 'ok',
      info: {
        database: {
          status: 'up',
          responseTime: dbStatus.responseTime ? `${dbStatus.responseTime}ms` : undefined,
        },
      },
      error: {},
      details: {
        database: {
          status: 'up',
          responseTime: dbStatus.responseTime ? `${dbStatus.responseTime}ms` : undefined,
        },
      },
    };
    return response.status(HttpStatus.OK).json(successResponse);
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe - checks if service is running (no DB check)' })
  @ApiResponse({
    status: 200,
    description: 'Service is alive',
  })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe - checks if service and database are ready' })
  @ApiResponse({
    status: 200,
    description: 'Service is ready (database connected)',
  })
  @ApiResponse({
    status: 503,
    description: 'Service is not ready (database not connected)',
  })
  async readiness(@Res() response: Response) {
    const dbStatus = await this.checkDatabaseDirectly();
    
    if (!dbStatus.connected) {
      const errorResponse = {
        status: 'error',
        info: {},
        error: {
          database: {
            status: 'down',
            message: dbStatus.message || 'Database connection failed',
          },
        },
        details: {
          database: {
            status: 'down',
            message: dbStatus.message || 'Database connection failed',
          },
        },
      };
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json(errorResponse);
    }

    const successResponse = {
      status: 'ok',
      info: {
        database: {
          status: 'up',
          responseTime: dbStatus.responseTime ? `${dbStatus.responseTime}ms` : undefined,
        },
      },
      error: {},
      details: {
        database: {
          status: 'up',
          responseTime: dbStatus.responseTime ? `${dbStatus.responseTime}ms` : undefined,
        },
      },
    };
    return response.status(HttpStatus.OK).json(successResponse);
  }

  private async checkDatabaseDirectly(): Promise<{ connected: boolean; message?: string; responseTime?: number }> {
    const startTime = Date.now();
    try {
      if (!this.dataSource) {
        return { connected: false, message: 'DataSource not available' };
      }

      if (!this.dataSource.isInitialized) {
        return { connected: false, message: 'Database connection not initialized' };
      }

      const queryPromise = this.dataSource.query('SELECT 1');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database query timeout after 5 seconds')), 5000),
      );

      await Promise.race([queryPromise, timeoutPromise]);
      const responseTime = Date.now() - startTime;
      return { connected: true, responseTime };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Database connection failed',
        responseTime,
      };
    }
  }
}

