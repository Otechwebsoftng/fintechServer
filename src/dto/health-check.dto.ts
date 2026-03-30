import { ApiProperty } from '@nestjs/swagger';

export class MemoryUsageDto {
  @ApiProperty({ example: '45.23 MB', description: 'Heap memory used' })
  heapUsed: string;

  @ApiProperty({ example: '67.89 MB', description: 'Total heap memory' })
  heapTotal: string;

  @ApiProperty({ example: '123.45 MB', description: 'Resident set size' })
  rss: string;
}

export class HealthDto {
  @ApiProperty({ example: 'healthy', description: 'Server health status' })
  status: string;

  @ApiProperty({ example: 123.456, description: 'Server uptime in seconds' })
  uptime: number;

  @ApiProperty({ example: 'development', description: 'Current environment' })
  environment: string;

  @ApiProperty({ type: MemoryUsageDto, description: 'Memory usage statistics' })
  memoryUsage: MemoryUsageDto;
}

export class HealthCheckResponseDto {
  @ApiProperty({ example: true, description: 'Request success status' })
  success: boolean;

  @ApiProperty({
    example: 'Welcome to FIN_TECH WHITE LABEL API',
    description: 'Welcome message',
  })
  message: string;

  @ApiProperty({ example: '1.0', description: 'API version' })
  version: string;

  @ApiProperty({
    example: '2026-03-27T10:00:00.000Z',
    description: 'Response timestamp',
  })
  timestamp: string;

  @ApiProperty({ example: '1.23 ms', description: 'Response time' })
  responseTime: string;

  @ApiProperty({ type: HealthDto, description: 'Server health information' })
  health: HealthDto;
}
