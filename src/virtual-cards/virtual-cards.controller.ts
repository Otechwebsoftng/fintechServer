// import { Controller, Get, Param, Post, Body, Headers, BadRequestException, Logger } from '@nestjs/common';
// import { VirtualCardsService } from './virtual-cards.service';

// @Controller('virtual-cards')
// export class VirtualCardsController {
//   private readonly logger = new Logger(VirtualCardsController.name);
  
//   constructor(private readonly virtualCardsService: VirtualCardsService) {}

//   /**
//    * Manual payment verification endpoint (requires JWT auth)
//    */
//   @Get('verify-payment/:paymentIntentId')
//   async verifyPayment(@Param('paymentIntentId') paymentIntentId: string) {
//     return this.virtualCardsService.verifyPayment(paymentIntentId);
//   }

//   /**
//    * Airwallex webhook endpoint for payment notifications
//    * This endpoint should be registered in Airwallex dashboard
//    * URL: https://yourdomain.com/virtual-cards/webhook/payment
//    */
//   @Post('webhook/payment')
//   async handlePaymentWebhook(
//     @Body() payload: any,
//     @Headers('x-signature') signature: string,
//   ) {
//     try {
//       this.logger.log('Received Airwallex webhook:', JSON.stringify(payload));

//       // Verify webhook signature (important for security)
//       const isValid = await this.virtualCardsService.verifyWebhookSignature(
//         payload,
//         signature,
//       );

//       if (!isValid) {
//         throw new BadRequestException('Invalid webhook signature');
//       }

//       // Process the webhook event
//       const result = await this.virtualCardsService.handlePaymentWebhook(payload);

//       return {
//         success: true,
//         message: 'Webhook processed successfully',
//         data: result,
//       };
//     } catch (error) {
//       this.logger.error('Webhook processing failed:', error);
//       throw error;
//     }
//   }
// }
