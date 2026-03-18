import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller()
@ApiTags('Root')
export class AppController {
  @Get()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Welcome endpoint with health check' })
  @ApiResponse({
    status: 201,
    description: 'Welcome message with application health',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'number', example: 201 },
        message: {
          type: 'string',
          example: 'Welcome to FIN_TECH WHITE LABEL API',
        },
        version: { type: 'string', example: '1.0' },
        timestamp: { type: 'string', example: '2026-03-11T10:00:00.000Z' },
        health: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'healthy' },
            uptime: { type: 'number', example: 123.456 },
            environment: { type: 'string', example: 'development' },
            memoryUsage: {
              type: 'object',
              properties: {
                heapUsed: { type: 'string', example: '45.23 MB' },
                heapTotal: { type: 'string', example: '67.89 MB' },
              },
            },
          },
        },
      },
    },
  })
  getRoot() {
    const memoryUsage = process.memoryUsage();
    return {
      status: HttpStatus.CREATED,
      message: 'Welcome to FIN_TECH WHITE LABEL API',
      version: '1.0',
      timestamp: new Date().toISOString(),
      health: {
        status: 'healthy',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        memoryUsage: {
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        },
      },
    };
  }
}
