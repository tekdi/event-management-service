import { Injectable, Logger } from '@nestjs/common';
import * as CircuitBreaker from 'opossum';

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private breakers: Map<string, CircuitBreaker> = new Map();

  createBreaker<T>(
    name: string,
    action: (...args: any[]) => Promise<T>,
    options?: CircuitBreaker.Options,
  ): CircuitBreaker<any[], T> {
    if (this.breakers.has(name)) {
      return this.breakers.get(name);
    }

    const defaultOptions: CircuitBreaker.Options = {
      timeout: 3000, // 3 seconds
      errorThresholdPercentage: 50,
      resetTimeout: 30000, // 30 seconds
      ...options,
    };

    const breaker = new CircuitBreaker(action, defaultOptions);

    // Event listeners for monitoring
    breaker.on('open', () => {
      this.logger.warn(`Circuit breaker ${name} opened`);
    });

    breaker.on('halfOpen', () => {
      this.logger.log(`Circuit breaker ${name} half-open`);
    });

    breaker.on('close', () => {
      this.logger.log(`Circuit breaker ${name} closed`);
    });

    breaker.on('failure', (error) => {
      this.logger.error(`Circuit breaker ${name} failure: ${error.message}`);
    });

    this.breakers.set(name, breaker);
    return breaker;
  }

  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getBreakerStats(name: string) {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      return null;
    }

    return {
      name,
      state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
      stats: breaker.stats,
    };
  }

  getAllStats() {
    const stats = [];
    this.breakers.forEach((breaker, name) => {
      stats.push(this.getBreakerStats(name));
    });
    return stats;
  }
}
