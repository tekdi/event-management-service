import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  const mockHealthService = {
    getHealthStatus: jest.fn(),
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

  it('should return health status', async () => {
    const mockResponse = {
      time: '2024-01-15T10:30:00.000Z',
      resmsgid: 'test-id',
      status: 'healthy' as const,
      checks: [
        { name: 'postgresql', healthy: true },
        { name: 'kafka', healthy: true },
      ],
    };

    mockHealthService.getHealthStatus.mockResolvedValue(mockResponse);

    const result = await controller.getHealth();

    expect(result).toEqual(mockResponse);
    expect(service.getHealthStatus).toHaveBeenCalled();
  });
});
