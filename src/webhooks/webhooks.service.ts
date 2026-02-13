// import {
//     BadRequestException,
//     Injectable,
//     NotFoundException,
// } from '@nestjs/common';
// import { PrismaService } from '../prisma/prisma.service';
// import { Logger } from '@nestjs/common';
// import { MailService } from 'src/mail/mail.service';
// import { PaymentUtility } from 'src/vendors/paystack.service';
// import { Currency, PaymentStatus } from '@prisma/client';

// @Injectable()
// export class WebhookService {
//     private readonly logger = new Logger(WebhookService.name);

//     constructor(
//         private readonly paymentUtility: PaymentUtility,
//         private readonly prisma: PrismaService,
//         private readonly mailService: MailService
//     ) {}

//     async fincraWebhook(payload: any, signature: string) {
//         this.validateSignature(payload, signature);

//         // Save the webhook payload to the database
//         await this.prisma.webhook.create({
//             data: {
//                 domain: payload.data?.domain,
//                 status: payload.data?.status,
//                 reference: payload.data?.reference,
//                 amount: payload.data?.amount,
//                 message: payload.data?.message,
//                 gateway_response: payload.data?.gateway_response,
//                 paid_at: payload.data?.paid_at
//                     ? new Date(payload.data.paid_at)
//                     : undefined,
//                 failed_at: payload.data?.failed_at
//                     ? new Date(payload.data.failed_at)
//                     : undefined,
//                 channel: payload.data?.channel,
//                 currency: payload.data?.currency,
//                 ip_address: payload.data?.ip_address,
//                 metadata: payload.data?.metadata,
//                 log: payload.data?.log,
//                 fees: payload.data?.fees,
//                 customer: payload.data?.customer,
//                 authorization: payload.data?.authorization,
//             },
//         });

//         switch (payload.event) {
//             case 'charge.success':
//                 return this.handleSuccessfulCharge(payload.data);

//             case 'charge.failed':
//                 return this.handleFailedCharge(payload.data);
//             case 'transfer.success':
//                 return this.handleSuccessfulTransfer(payload.data);
//             default:
//                 this.logger.log(`Unhandled event type: ${payload.event}`);
//         }
//     }

//     private validateSignature(payload: any, signature: string) {
//         if (!this.paymentUtility.verifyWebhook(payload, signature)) {
//             this.logger.warn('Invalid webhook signature');
//             throw new BadRequestException('Invalid signature');
//         }
//     }

//     private async handleSuccessfulCharge(data: any) {
//         return this.prisma.$transaction(async tx => {
//             // 1) check if the reference exist
//             const payment = await this.verifyPaymentRecord(data.reference, tx);

//             // 2) Update the payment status to success
//             await this.updatePaymentStatus(
//                 payment.reference,
//                 PaymentStatus.SUCCESS,
//                 { paid_at: new Date() },
//                 tx
//             );

//             // 3) update order isPaid Status
//             const updateOrder = await tx.order.update({
//                 where: { id: payment.orderId },
//                 data: {
//                     isPaid: true,
//                 },
//             });

//             // 4) Prepare receipt details
//             const receiptDetails = {
//                 firstName: payment.user?.firstName || 'Customer',
//                 lastName: payment.user?.lastName || '',
//                 email: payment.user?.email || '',
//                 amount: payment.amount,
//                 orderNumber: updateOrder.orderNumber,
//                 paymentMethod: data.authorization?.channel || 'card',
//                 Currency: data.authorization?.currency || Currency.NGN,
//                 transactionDate: new Date().toISOString(),
//                 reference: payment.reference,
//             };

//             // 5) Send email receipt
//             await this.mailService.paymentReceipt(
//                 receiptDetails.email,
//                 receiptDetails.firstName,
//                 receiptDetails.lastName,
//                 receiptDetails.amount,
//                 receiptDetails.Currency,
//                 receiptDetails.orderNumber
//             );

//             // 6) Process specific payment types

//             return { processed: true };
//         });
//     }

//     private async handleSuccessfulTransfer(data: any) {
//         return this.prisma.$transaction(async tx => {
//             const payment = await this.verifyPaymentRecord(data.reference, tx);
//             await this.updatePaymentStatus(
//                 payment.reference,
//                 PaymentStatus.SUCCESS,
//                 { paid_at: new Date() },
//                 tx
//             );
//             this.logger.log(
//                 `Transfer successful for payment ${data.reference}`
//             );
//         });
//     }

//     private async verifyPaymentRecord(reference: string, tx: any) {
//         const payment = await this.prisma.payments.findUnique({
//             where: { reference },
//             include: { user: true },
//         });
//         if (!payment) throw new NotFoundException('Payment not found');
//         if (payment.status === PaymentStatus.SUCCESS) {
//             this.logger.log(`Payment ${reference} already processed`);
//             throw new Error('Payment already processed');
//         }
//         return payment;
//     }

//     private async updatePaymentStatus(
//         reference: string,
//         status: PaymentStatus,
//         additionalData: object,
//         tx: any
//     ) {
//         return tx.payments.update({
//             where: { reference },
//             data: {
//                 status,
//                 ...additionalData,
//             },
//         });
//     }

//     private async handleFailedCharge(data: any) {
//         return this.prisma.payments.update({
//             where: { reference: data.reference },
//             data: {
//                 status: PaymentStatus.FAILED,
//                 failed_at: new Date(),
//                 failure_reason: data.gateway_response,
//                 failure_code: data.errors?.code,
//             },
//         });
//     }
// }
