import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { KafkaService } from '../kafka/kafka.service';
import { DataSource } from 'typeorm';

describe('HealthService', () => {
  let service: HealthService;
  let kafkaService: KafkaService;
  let dataSource: DataSource;

  const mockKafkaService = {
    checkHealth: jest.fn(),
  };

  const mockDataSource = {
    isInitialized: true,
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: KafkaService,
          useValue: mockKafkaService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    kafkaService = module.get<KafkaService>(KafkaService);
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return correct health response structure', async () => {
    // Mock successful health checks
    mockKafkaService.checkHealth.mockResolvedValue(true);
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    const result = await service.checkHealth();

    expect(result).toHaveProperty('id', 'api.content.health');
    expect(result).toHaveProperty('ver', '3.0');
    expect(result).toHaveProperty('ts');
    expect(result).toHaveProperty('params');
    expect(result.params).toHaveProperty('resmsgid');
    expect(result.params).toHaveProperty('msgid', null);
    expect(result.params).toHaveProperty('err', null);
    expect(result.params).toHaveProperty('status', 'successful');
    expect(result.params).toHaveProperty('errmsg', null);
    expect(result).toHaveProperty('responseCode', 'OK');
    expect(result).toHaveProperty('result');
    expect(result.result).toHaveProperty('checks');
    expect(result.result).toHaveProperty('healthy');
    expect(result.result.checks).toHaveLength(2);
    
    const postgresCheck = result.result.checks.find(check => check.name === 'postgresql');
    const kafkaCheck = result.result.checks.find(check => check.name === 'kafka');
    
    expect(postgresCheck).toEqual({ name: 'postgresql', healthy: true });
    expect(kafkaCheck).toEqual({ name: 'kafka', healthy: true });
    expect(result.result.healthy).toBe(true);
  });

  it('should handle database connection failure', async () => {
    // Mock failed database connection
    mockKafkaService.checkHealth.mockResolvedValue(true);
    mockDataSource.query.mockRejectedValue(new Error('Connection failed'));

    const result = await service.checkHealth();

    const postgresCheck = result.result.checks.find(check => check.name === 'postgresql');
    const kafkaCheck = result.result.checks.find(check => check.name === 'kafka');
    
    expect(postgresCheck).toEqual({ name: 'postgresql', healthy: false });
    expect(kafkaCheck).toEqual({ name: 'kafka', healthy: true });
    expect(result.result.healthy).toBe(false);
  });

  it('should handle kafka connection failure', async () => {
    // Mock failed kafka connection
    mockKafkaService.checkHealth.mockResolvedValue(false);
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    const result = await service.checkHealth();

    const postgresCheck = result.result.checks.find(check => check.name === 'postgresql');
    const kafkaCheck = result.result.checks.find(check => check.name === 'kafka');
    
    expect(postgresCheck).toEqual({ name: 'postgresql', healthy: true });
    expect(kafkaCheck).toEqual({ name: 'kafka', healthy: false });
    expect(result.result.healthy).toBe(false);
  });
});