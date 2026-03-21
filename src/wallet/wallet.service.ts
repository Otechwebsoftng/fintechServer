import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Currency,
  PaymentEntry,
  WalletStatus,
  WalletType,
} from '@prisma/client';
import { CustomLogger } from 'src/custom.logger';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { FundWalletDto } from './dto/fund.dto';
import { GraphService } from 'src/vendors/graph.service';

@Injectable()
export class WalletService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly logger: CustomLogger,
    private readonly graphService: GraphService,
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

  //Wallet creation logic for NGN, USD and EUR is the same except for the currency type.

  async createVirtualAccountForCurrency(
    userId: string,
    graphPersonId: string,
    currency: Currency,
  ) {
    // Check if NGN wallet already exists for this user
    const existingWallet = await this.getOne({
      userId,
      currency: currency,
    });

    if (existingWallet) {
      return {
        message: `${currency} wallet already exists`,
        data: existingWallet,
      };
    }

    // Generate Graph NGN account
    const graphResponse = await this.graphService.createVirtualAccount(
      graphPersonId,
      currency,
    );

    // Create wallet in database
    const newWallet = await this.prisma.wallet.create({
      data: {
        userId: userId,
        currency: currency,
        accountType: WalletType.INDIVIDUAL,
        holderId: graphResponse.holder_id,
        holderType: graphResponse.holder_type,
        virtualAccountId: graphResponse.id,
        status: WalletStatus.APPROVED,
        bankName: graphResponse.bank_name,
        bankCode: graphResponse.bank_code,
        accountNumber: graphResponse.account_number,
        graphStatus: graphResponse.status,
      },
    });

    const { isDeleted, createdAt, updatedAt, ...walletData } = newWallet;

    return {
      message: `${currency} Wallet created`,
      data: walletData,
    };
  }

  async createVirtualNGNAccount(userId: string, personId: string) {
    return this.createVirtualAccountForCurrency(userId, personId, Currency.NGN);
  }

  async createVirtualUSDAccount(userId: string, personId: string) {
    return this.createVirtualAccountForCurrency(userId, personId, Currency.USD);
  }
  async createVirtualEURAccount(userId: string, personId: string) {
    return this.createVirtualAccountForCurrency(userId, personId, Currency.EUR);
  }

  //Wallet creation ends here.

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
    if (payload.amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findFirst({
        where: { userId, currency: payload.currency },
      });

      if (!wallet) {
        throw new NotFoundException(
          'Wallet not found for the user or specified currency',
        );
      }

      const payment = await tx.payment.create({
        data: {
          userId: payload.userId,
          amount: payload.amount,
          merchant_order_id: payload.merchant_order_id,
          request_id: payload.request_id,
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
