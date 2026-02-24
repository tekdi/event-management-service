import { Controller, Get } from '@nestjs/common';
import { CircuitBreakerService } from 'src/common/circuit-breaker/circuit-breaker.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly circuitBreakerService: CircuitBreakerService) {}

  @Get('circuit-breakers')
  getCircuitBreakerStats() {
    return {
      timestamp: new Date().toISOString(),
      breakers: this.circuitBreakerService.getAllStats(),
    };
  }

  @Get('metrics')
  getMetrics() {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      timestamp: new Date().toISOString(),
      process: {
        pid: process.pid,
        uptime: uptime,
        uptimeFormatted: this.formatUptime(uptime),
      },
      memory: {
        rss: this.formatBytes(memoryUsage.rss),
        heapTotal: this.formatBytes(memoryUsage.heapTotal),
        heapUsed: this.formatBytes(memoryUsage.heapUsed),
        external: this.formatBytes(memoryUsage.external),
        arrayBuffers: this.formatBytes(memoryUsage.arrayBuffers),
      },
      cpu: {
        user: process.cpuUsage().user,
        system: process.cpuUsage().system,
      },
    };
  }

  private formatBytes(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  }
}
