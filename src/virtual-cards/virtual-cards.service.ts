// import { Injectable, Logger } from '@nestjs/common';
// import { AirwallexService } from 'src/vendors/airwallex.service';
// import { PrismaService } from 'src/prisma/prisma.service';
// import * as crypto from 'crypto';
// import { ConfigService } from '@nestjs/config';

// @Injectable()
// export class VirtualCardsService {
//   private readonly logger = new Logger(VirtualCardsService.name);

//   constructor(
//     private readonly airwallexService: AirwallexService,
//     private readonly prisma: PrismaService,
//     private readonly configService: ConfigService,
//   ) {}

//   async verifyPayment(paymentIntentId: string) {
//     return this.airwallexService.verifyPayment(paymentIntentId);
//   }

//   /**
//    * Verify webhook signature from Airwallex
//    */
//   async verifyWebhookSignature(payload: any, signature: string): Promise<boolean> {
//     try {
//       const webhookSecret = this.configService.get<string>('AIRWALLEX_WEBHOOK_SECRET');
      
//       if (!webhookSecret) {
//         this.logger.warn('AIRWALLEX_WEBHOOK_SECRET not configured, skipping signature verification');
//         return true; // Allow in development, but should be enforced in production
//       }

//       // Create HMAC signature
//       const hmac = crypto.createHmac('sha256', webhookSecret);
//       const expectedSignature = hmac.update(JSON.stringify(payload)).digest('hex');

//       return signature === expectedSignature;
//     } catch (error) {
//       this.logger.error('Signature verification failed:', error);
//       return false;
//     }
//   }

//   /**
//    * Handle payment webhook from Airwallex
//    */
//   async handlePaymentWebhook(payload: any) {
//     const { name, data } = payload;

//     this.logger.log(`Processing webhook event: ${name}`);

//     switch (name) {
//       case 'payment_intent.succeeded':
//         return this.handlePaymentSuccess(data);
      
//       case 'payment_intent.failed':
//         return this.handlePaymentFailure(data);
      
//       case 'payment_intent.cancelled':
//         return this.handlePaymentCancelled(data);
      
//       case 'payment_intent.requires_payment_method':
//         return this.handlePaymentPending(data);
      
//       default:
//         this.logger.warn(`Unhandled webhook event: ${name}`);
//         return { status: 'ignored', event: name };
//     }
//   }

//   private async handlePaymentSuccess(data: any) {
//     const { id, amount, currency, customer_id } = data;

//     this.logger.log(`Payment succeeded: ${id}, Amount: ${amount} ${currency}`);

//     // TODO: Update your database with successful payment
//     // Example:
//     await this.prisma.payment.update({
//       where: { paymentIntentId: id },
//       data: {
//         status: 'COMPLETED',
//         completedAt: new Date(),
//       },
//     });

//     return {
//       status: 'success',
//       paymentIntentId: id,
//       amount,
//       currency,
//       customerId: customer_id,
//     };
//   }

//   private async handlePaymentFailure(data: any) {
//     const { id, amount, currency, latest_payment_error } = data;

//     this.logger.error(`Payment failed: ${id}, Error: ${latest_payment_error?.message}`);

//     // TODO: Update your database with failed payment
//     // await this.prisma.payment.update({
//     //   where: { paymentIntentId: id },
//     //   data: {
//     //     status: 'FAILED',
//     //     errorMessage: latest_payment_error?.message,
//     //   },
//     // });

//     return {
//       status: 'failed',
//       paymentIntentId: id,
//       error: latest_payment_error,
//     };
//   }

//   private async handlePaymentCancelled(data: any) {
//     const { id } = data;

//     this.logger.log(`Payment cancelled: ${id}`);

//     // TODO: Update your database
//     // await this.prisma.payment.update({
//     //   where: { paymentIntentId: id },
//     //   data: { status: 'CANCELLED' },
//     // });

//     return {
//       status: 'cancelled',
//       paymentIntentId: id,
//     };
//   }

//   private async handlePaymentPending(data: any) {
//     const { id } = data;

//     this.logger.log(`Payment pending: ${id}`);

//     return {
//       status: 'pending',
//       paymentIntentId: id,
//     };
//   }
// }
