import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';
import { Currency, PaymentEntry, PaymentStatus } from '@prisma/client';
import { SignatureService } from './signature.service';
import { Utility } from 'src/helpers/utilities.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private signatureService: SignatureService,
  ) {}

  async graphTransactionWebhook(payload: any, signature: string) {
    this.validateSignature(payload, signature);

    // Save the webhook payload to the database
    await this.prisma.webhook.create({
      data: {
        accountId: payload.data?.account_id,
        depositId: payload.data?.deposit.id,
        status: payload.data?.status,
        amount: Utility.CurrencyBroken(payload.data.data?.amount),
        fee: Utility.CurrencyBroken(payload.data?.deposit.fee),
        amountSettled: Utility.CurrencyBroken(
          payload.data?.deposit.amount_settled,
        ),
        currency: payload.data?.deposit.currency,
        kind: payload.data?.kind,
        type: payload.data?.type,
        paid_at: payload.data?.paid_at
          ? new Date(payload.data.paid_at)
          : undefined,
      },
    });

    switch (payload.event) {
      case 'payout.success':
        return this.handleSuccessfulPayout(payload.data);

      case 'account.credit':
        return this.handleSuccessfulDeposit(payload.data);

      case 'payout.failed':
        return this.handleFailedPayout(payload.data);
      default:
        this.logger.log(`Unhandled event type: ${payload.event}`);
    }
  }

  private validateSignature(payload: any, signature: string) {
    if (!this.signatureService.verifySignature(payload, signature)) {
      this.logger.warn('Invalid webhook signature');
      throw new BadRequestException('Invalid signature');
    }
  }

  private async handleSuccessfulPayout(data: any) {
    const payoutId = data.payout_id;

    return this.prisma.$transaction(async (tx) => {
      // 1. Find Sender
      const sTx = await tx.walletTransaction.findFirst({
        where: { payoutId },
        include: { wallet: { include: { user: true } } },
      });

      if (!sTx || sTx.status === PaymentStatus.SUCCESS)
        return { processed: false };

      // 2. Update Sender Status
      await tx.walletTransaction.update({
        where: { id: sTx.id },
        data: { status: PaymentStatus.SUCCESS },
      });
      await tx.payment.update({
        where: { id: sTx.paymentId },
        data: { status: PaymentStatus.SUCCESS },
      });

      // 3. Find and Update Receiver (Only for internal transfers)
      const rTx = await tx.walletTransaction.findFirst({
        where: { linkedTxId: sTx.id },
      });
      if (rTx) {
        await tx.walletTransaction.update({
          where: { id: rTx.id },
          data: { status: PaymentStatus.SUCCESS },
        });
        await tx.payment.update({
          where: { id: rTx.paymentId },
          data: { status: PaymentStatus.SUCCESS },
        });
      }

      await this.mailService.debitMail(
        sTx.wallet.user.email,
        sTx.wallet.user.firstName,
        data.amount,
      );
      return { processed: true };
    });
  }
  private async handleFailedPayout(data: any) {
    const payoutId = data.payout_id;
    const isSuccessful = data.status === 'successful'; // Logic based on provider's payload
    const finalStatus = isSuccessful
      ? PaymentStatus.SUCCESS
      : PaymentStatus.FAILED;
    return this.prisma.$transaction(async (tx) => {
      const senderTx = await tx.walletTransaction.findFirst({
        where: { payoutId: payoutId },
        include: { wallet: { include: { user: true } } },
      });

      if (!senderTx)
        throw new NotFoundException('Transaction record not found');
      if (senderTx.status === PaymentStatus.SUCCESS)
        return { processed: false };

      await tx.walletTransaction.update({
        where: { id: senderTx.id },
        data: { status: finalStatus },
      });

      if (senderTx.paymentId) {
        await tx.payment.update({
          where: { id: senderTx.paymentId },
          data: { status: finalStatus },
        });
      }

      if (senderTx.linkedTxId) {
        const receiverTx = await tx.walletTransaction.update({
          where: { id: senderTx.linkedTxId },
          data: { status: finalStatus },
        });

        if (receiverTx.paymentId) {
          await tx.payment.update({
            where: { id: receiverTx.paymentId },
            data: { status: finalStatus },
          });
        }
      }
      if (isSuccessful) {
        await this.mailService.debitMail(
          senderTx.wallet.user.email,
          senderTx.wallet.user.firstName,
          data.amount,
        );
      } else {
        // Logic for notifying user of failure or triggering reversal alert
      }

      return { processed: true };
    });
  }

  private async handleSuccessfulDeposit(data: any) {
    const depositId = data.deposit.id;
    const accountId = data.account_id;
    const reference = `transfer_${depositId}`;
    const finalStatus =
      data.status === 'successful'
        ? PaymentStatus.SUCCESS
        : PaymentStatus.FAILED;

    const existingPayment = await this.prisma.payment.findFirst({
      where: { transactionId: depositId },
    });

    if (existingPayment) {
      this.logger.warn(`Deposit ${depositId} already processed. Skipping.`);
      return { processed: false, message: 'Duplicate' };
    }
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // get UserId from accountId
        const wallet = await tx.wallet.findUnique({
          where: { virtualAccountId: accountId },
          include: { user: true },
        });

        console.log('Wallet found for account ID:', wallet);

        if (!wallet) {
          throw new NotFoundException('Wallet not found');
        }

        const payment = await tx.payment.create({
          data: {
            userId: wallet.userId,
            virtualAccountId: data.account_id,
            transactionId: data.deposit.id,
            amount: Utility.CurrencyBroken(data.deposit.amount),
            reference: reference,
            status:
              data.status === 'successful'
                ? PaymentStatus.SUCCESS
                : PaymentStatus.FAILED,
            currency: this.mapCurrency(data.deposit.currency),
            amountSettled: data.deposit.amount_settled,
            fee: Utility.CurrencyBroken(data.deposit.fee),
            type: data.type,
            paymentEntry: PaymentEntry.CREDIT,
            description: data.description,
          },
        });

        //4. create wallet transaction
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            transactionId: data.deposit.id,
            amount: Utility.CurrencyBroken(data.deposit.amount_settled),
            reference: reference,
            currency: payment.currency,
            transactionType: PaymentEntry.CREDIT,
            paymentId: payment.id,
            status: payment.status,
            description: payment.description,
          },
        });

        return {
          email: wallet.user.email,
          firstName: wallet.user.firstName,
          amount: data.deposit.amount,
          status: finalStatus,
        };
      });
      if (result && result.status === PaymentStatus.SUCCESS) {
        await this.mailService.creditMail(
          result.email,
          result.firstName,
          result.amount,
        );
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to process deposit ${depositId}`, error.stack);
      throw error;
    }
  }

  private mapCurrency(currency: string): Currency {
    const c = currency?.toUpperCase();
    return (Object.values(Currency) as string[]).includes(c)
      ? (c as Currency)
      : Currency.NGN;
  }
}
