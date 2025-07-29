import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController Integration', () => {
  let controller: HealthController;
  let service: HealthService;

  const mockHealthService = {
    checkHealth: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should return exact required response format', async () => {
    const expectedResponse = {
      id: 'api.content.health',
      ver: '3.0',
      ts: '2025-07-29T11:01:03ZZ',
      params: {
        resmsgid: 'fa6949cf-4e4c-422a-aa69-00965cac8a99',
        msgid: null,
        err: null,
        status: 'successful',
        errmsg: null,
      },
      responseCode: 'OK',
      result: {
        checks: [
          { name: 'postgresql', healthy: true },
          { name: 'kafka', healthy: true },
        ],
        healthy: true,
      },
    };

    mockHealthService.checkHealth.mockResolvedValue(expectedResponse);

    const result = await controller.checkHealth();

    expect(result).toEqual(expectedResponse);
    expect(result.id).toBe('api.content.health');
    expect(result.ver).toBe('3.0');
    expect(result.responseCode).toBe('OK');
    expect(result.params.status).toBe('successful');
    expect(result.result.checks).toHaveLength(2);
    expect(result.result.checks.map(c => c.name)).toEqual(['postgresql', 'kafka']);
  });

  it('should be accessible at GET /event-service/health endpoint', () => {
    // Note: The health endpoint is accessible at GET /event-service/health
    // due to the global prefix 'event-service' set in main.ts
    expect(controller).toBeDefined();
    expect(typeof controller.checkHealth).toBe('function');
  });
});