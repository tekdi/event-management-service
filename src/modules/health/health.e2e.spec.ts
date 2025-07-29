import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('Health endpoint (e2e)', () => {
  let app: INestApplication;

  const mockHealthService = {
    getHealthStatus: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('event-service');
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/event-service/health (GET) - should return healthy status', async () => {
    const mockResponse = {
      time: '2024-01-15T10:30:00.000Z',
      resmsgid: 'abc123def456',
      status: 'healthy' as const,
      checks: [
        { name: 'postgresql', healthy: true },
        { name: 'kafka', healthy: true },
      ],
    };

    mockHealthService.getHealthStatus.mockResolvedValue(mockResponse);

    const response = await request(app.getHttpServer())
      .get('/event-service/health')
      .expect(200);

    expect(response.body).toEqual(mockResponse);
    expect(mockHealthService.getHealthStatus).toHaveBeenCalled();
  });

  it('/event-service/health (GET) - should return unhealthy status', async () => {
    const mockResponse = {
      time: '2024-01-15T10:30:00.000Z',
      resmsgid: 'abc123def456',
      status: 'unhealthy' as const,
      checks: [
        { name: 'postgresql', healthy: false },
        { name: 'kafka', healthy: false },
      ],
    };

    mockHealthService.getHealthStatus.mockResolvedValue(mockResponse);

    const response = await request(app.getHttpServer())
      .get('/event-service/health')
      .expect(200);

    expect(response.body).toEqual(mockResponse);
    expect(mockHealthService.getHealthStatus).toHaveBeenCalled();
  });
});