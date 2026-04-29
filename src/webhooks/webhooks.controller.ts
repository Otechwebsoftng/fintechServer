import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomLogger } from 'src/custom.logger';
import { WebhookService } from './webhooks.service';
@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly customLogger: CustomLogger,
  ) {}
  @ApiOperation({
    description: 'Receives Webhooks',
    summary: 'Get the wallets of a currently logged in user ',
  })
  @HttpCode(HttpStatus.OK)
  @Post('/')
  async checkKycStatus(
    @Body() payload: any,
    @Headers('verif-hash') signature: string,
  ) {
    try {
      const result = await this.webhookService.graphTransactionWebhook(
        payload,
        signature,
      );

      return {
        status: 'success',
        message: 'Webhook processed',
        data: result,
      };
    } catch (error) {
      // Still return 200 to Flutterwave to prevent retries for invalid webhooks
      return {
        status: 'error',
        message: error.message,
      };
    }
  }
}
