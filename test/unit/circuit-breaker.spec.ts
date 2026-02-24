import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService } from '../../src/common/circuit-breaker/circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CircuitBreakerService],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBreaker', () => {
    it('should create a circuit breaker', () => {
      const action = jest.fn().mockResolvedValue('success');
      const breaker = service.createBreaker('test-breaker', action);

      expect(breaker).toBeDefined();
      expect(breaker.name).toBe('test-breaker');
    });

    it('should reuse existing circuit breaker', () => {
      const action = jest.fn().mockResolvedValue('success');
      const breaker1 = service.createBreaker('test-breaker-2', action);
      const breaker2 = service.createBreaker('test-breaker-2', action);

      expect(breaker1).toBe(breaker2);
    });

    it('should execute action through circuit breaker', async () => {
      const action = jest.fn().mockResolvedValue('success');
      const breaker = service.createBreaker('test-breaker-3', action);

      const result = await breaker.fire();

      expect(result).toBe('success');
      expect(action).toHaveBeenCalled();
    });

    it('should open circuit on failures', async () => {
      let callCount = 0;
      const action = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 10) {
          return Promise.reject(new Error('Service unavailable'));
        }
        return Promise.resolve('success');
      });

      const breaker = service.createBreaker('test-breaker-4', action, {
        timeout: 1000,
        errorThresholdPercentage: 50,
        resetTimeout: 1000,
      });

      // Make multiple failing calls
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          breaker.fire().catch(err => err)
        );
      }

      await Promise.all(promises);

      // Circuit should be open after failures
      expect(breaker.opened || breaker.halfOpen).toBeTruthy();
    });
  });

  describe('getBreakerStats', () => {
    it('should return breaker statistics', () => {
      const action = jest.fn().mockResolvedValue('success');
      service.createBreaker('test-breaker-5', action);

      const stats = service.getBreakerStats('test-breaker-5');

      expect(stats).toBeDefined();
      expect(stats.name).toBe('test-breaker-5');
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('stats');
    });

    it('should return null for non-existent breaker', () => {
      const stats = service.getBreakerStats('non-existent');
      expect(stats).toBeNull();
    });
  });

  describe('getAllStats', () => {
    it('should return all breaker statistics', () => {
      const action = jest.fn().mockResolvedValue('success');
      service.createBreaker('breaker-1', action);
      service.createBreaker('breaker-2', action);

      const allStats = service.getAllStats();

      expect(Array.isArray(allStats)).toBe(true);
      expect(allStats.length).toBeGreaterThanOrEqual(2);
    });
  });
});
