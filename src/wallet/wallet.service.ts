import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Currency, PaymentEntry } from '@prisma/client';
import { Exclude } from 'class-transformer';
import { CustomLogger } from 'src/custom.logger';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { FundWalletDto } from './dto/fund.dto';

@Injectable()
export class WalletService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly logger: CustomLogger,
    private readonly mailService: MailService,
  ) {}

  async getOne(criteria: any) {
    return await this.prisma.wallet.findFirst({
      where: { ...criteria },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async getUserWallets(userId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
    });

    if (wallets.length === 0) {
      throw new NotFoundException('No wallets found for this user');
    }

    return wallets;
  }

  async createUserWallet(userId: string, tx?: any) {
    const createWallets = async (prisma: any) => {
      // Check if wallets already exist for this user
      const existingWallets = await prisma.wallet.findMany({
        where: { userId },
      });

      if (existingWallets.length > 0) {
        throw new BadRequestException('This user already has wallets');
      }

      // Create wallets for all supported currencies
      const currencies = [
        Currency.NGN,
        Currency.USD,
        Currency.EUR,
        Currency.CAD,
        Currency.GBP,
      ];

      const wallets = await Promise.all(
        currencies.map((currency) =>
          prisma.wallet.create({
            data: { userId, currency },
          }),
        ),
      );

      return {
        ngnWallet: wallets[0],
        usdWallet: wallets[1],
        eurWallet: wallets[2],
        cadWallet: wallets[3],
        gbpWallet: wallets[4],
      };
    };

    // If transaction is provided, use it; otherwise create a new transaction
    if (tx) {
      return createWallets(tx);
    }

    return this.prisma.$transaction(createWallets);
  }

  async getWalletBalance(userId: string, currency: Currency) {
    //validate currency as query param
    if (!Object.values(Currency).includes(currency)) {
      throw new BadRequestException('Invalid currency');
    }

    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, currency },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const walletCredit = await this.prisma.walletTransaction.aggregate({
      where: { walletId: wallet.id, transactionType: PaymentEntry.CREDIT },
      _sum: { amount: true },
    });

    const walletDebit = await this.prisma.walletTransaction.aggregate({
      where: { walletId: wallet.id, transactionType: PaymentEntry.DEBIT },
      _sum: { amount: true },
    });

    const totalCredit = walletCredit._sum.amount || 0;
    const totalDebit = walletDebit._sum.amount || 0;

    const balance = totalCredit - totalDebit;

    return { currency: wallet.currency, balance };
  }

  async fundOwnWallet(userId: string, payload: FundWalletDto) {
    // Validate amount
    if (payload.amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    // Record the payment and the wallet transaction using a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Fetch wallet inside transaction for atomicity
      const wallet = await tx.wallet.findFirst({
        where: { userId, currency: payload.currency },
      });

      if (!wallet) {
        throw new NotFoundException(
          'Wallet not found for the user or specified currency',
        );
      }

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          userId: payload.userId,
          amount: payload.amount,
          currency: payload.currency,
          description: payload.description,
          reference: payload.reference,
          paymentMethod: payload.paymentMethod,
        },
      });

      const walletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: payment.amount,
          currency: payment.currency,
          transactionType: PaymentEntry.CREDIT,
          paymentId: payment.id,
          description: payload.description,
          reference: payload.reference,
        },
      });

      return { payment, walletTransaction };
    });

    return {
      message: 'Wallet funded successfully',
      data: result,
    };
  }

  async getBalance(walletId: string): Promise<{ data: number }> {
    if (!walletId?.trim()) {
      throw new BadRequestException('Wallet ID is required');
    }

    const [creditSum, debitSum] = await Promise.all([
      this.getTransactionSum(walletId, PaymentEntry.CREDIT),
      this.getTransactionSum(walletId, PaymentEntry.DEBIT),
    ]);

    return { data: creditSum - debitSum };
  }

  private async getTransactionSum(
    walletId: string,
    transactionType: PaymentEntry,
  ): Promise<number> {
    const result = await this.prisma.walletTransaction.aggregate({
      where: { walletId, transactionType },
      _sum: { amount: true },
    });

    return result._sum.amount ?? 0;
  }
}
