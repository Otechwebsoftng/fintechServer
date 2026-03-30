import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { HealthCheckResponseDto } from './dto/health-check.dto';

@Controller()
@ApiTags('Root')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Welcome endpoint with health check' })
  @ApiResponse({
    status: 200,
    description: 'Welcome message with application health',
    type: HealthCheckResponseDto,
  })
  getRoot(): HealthCheckResponseDto {
    return this.appService.getHealthCheck();
  }
}
