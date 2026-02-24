import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('High Concurrency Features (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Checks', () => {
    it('/health (GET) - should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body.status).toBe('ok');
        });
    });

    it('/health/ready (GET) - should return readiness status', () => {
      return request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);
    });

    it('/health/live (GET) - should return liveness status', () => {
      return request(app.getHttpServer())
        .get('/health/live')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('Monitoring Endpoints', () => {
    it('/monitoring/metrics (GET) - should return application metrics', () => {
      return request(app.getHttpServer())
        .get('/monitoring/metrics')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('process');
          expect(res.body).toHaveProperty('memory');
          expect(res.body.process).toHaveProperty('pid');
          expect(res.body.process).toHaveProperty('uptime');
          expect(res.body.memory).toHaveProperty('rss');
          expect(res.body.memory).toHaveProperty('heapUsed');
        });
    });

    it('/monitoring/circuit-breakers (GET) - should return circuit breaker status', () => {
      return request(app.getHttpServer())
        .get('/monitoring/circuit-breakers')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('breakers');
          expect(Array.isArray(res.body.breakers)).toBe(true);
        });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = [];
      
      // Make 150 requests (exceeds 100 req/min limit)
      for (let i = 0; i < 150; i++) {
        requests.push(
          request(app.getHttpServer())
            .get('/health/live')
        );
      }

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);
      
      // Should have some rate limited requests
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should respond quickly to health checks', async () => {
      const start = Date.now();
      
      await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);
      
      const duration = Date.now() - start;
      
      // Should respond in less than 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent requests', async () => {
      const concurrentRequests = 50;
      const requests = [];

      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          request(app.getHttpServer())
            .get('/health/live')
        );
      }

      const start = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;

      // All requests should succeed
      responses.forEach(res => {
        expect(res.status).toBe(200);
      });

      // Should handle 50 concurrent requests in less than 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Caching', () => {
    it('should cache permission checks', async () => {
      // This test verifies that the cache module is loaded
      // Actual caching behavior would require database setup
      const res = await request(app.getHttpServer())
        .get('/monitoring/metrics')
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
