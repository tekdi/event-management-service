import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
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

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health check result', async () => {
    const mockResult = {
      id: 'api.content.health',
      ver: '3.0',
      ts: '2025-01-01T00:00:00.000Z',
      params: {
        resmsgid: 'test-uuid',
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

    mockHealthService.checkHealth.mockResolvedValue(mockResult);

    const result = await controller.checkHealth();

    expect(service.checkHealth).toHaveBeenCalled();
    expect(result).toEqual(mockResult);
  });
});