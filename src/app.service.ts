import { Injectable } from '@nestjs/common';
import { HealthCheckResponseDto } from './dto/health-check.dto';

@Injectable()
export class AppService {
  /**
   * Get server health check information
   * @returns Health check response with application status
   */
  getHealthCheck(): HealthCheckResponseDto {
    const startTime = performance.now();
    const memoryUsage = process.memoryUsage();

    const response: HealthCheckResponseDto = {
      success: true,
      message: 'Welcome to FIN_TECH WHITE LABEL API',
      version: '1.0',
      timestamp: new Date().toISOString(),
      responseTime: '',
      health: {
        status: 'healthy',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        memoryUsage: {
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
        },
      },
    };

    const endTime = performance.now();
    response.responseTime = `${(endTime - startTime).toFixed(2)} ms`;

    return response;
  }
}
