import {
  BadRequestException,
  ConflictException,
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

  async createVirtualNGNAccount(userId: string, graphPersonId: string) {
    try {
      console.log(
        'Creating virtual account for userId:',
        userId,
        'with graphPersonId:',
        graphPersonId,
      );

      // Check if NGN wallet already exists for this user
      const existingWallet = await this.getOne({
        userId,
        currency: Currency.NGN,
      });

      if (existingWallet) {
        this.logger.log(
          `NGN wallet already exists for user ${userId}`,
          'WalletService',
        );
        const { isDeleted, createdAt, updatedAt, ...walletData } =
          existingWallet;
        return {
          message: 'NGN wallet already exists',
          data: walletData,
        };
      }

      // Generate Graph NGN account
      const graphResponse =
        await this.graphService.createVirtualAccount(graphPersonId);

      // Create wallet in database
      const newWallet = await this.prisma.wallet.create({
        data: {
          userId: userId,
          currency: Currency.NGN,
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

      this.logger.log(
        `NGN virtual account created successfully for user ${userId}`,
      );

      return {
        message: 'NGN virtual account created successfully',
        data: walletData,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create NGN virtual account for user ${userId}: ${error.message}`,
        error,
      );

      if (error.code === 'P2002') {
        throw new ConflictException(
          'NGN virtual account already exists for this user',
        );
      }

      throw new BadRequestException(
        'Failed to create NGN virtual account. Please try again later.',
      );
    }
  }
  async createVirtualUSDAccount(userId: string, graphPersonId: string) {
    try {
      console.log(
        'Creating virtual account for userId:',
        userId,
        'with graphPersonId:',
        graphPersonId,
      );

      // Check if USD wallet already exists for this user
      const existingWallet = await this.getOne({
        userId,
        currency: Currency.USD,
      });

      if (existingWallet) {
        this.logger.log(
          `USD wallet already exists for user ${userId}`,
          'WalletService',
        );
        const { isDeleted, createdAt, updatedAt, ...walletData } =
          existingWallet;
        return {
          message: 'USD wallet already exists',
          data: walletData,
        };
      }

      // Generate Graph USD account
      const graphResponse =
        await this.graphService.createVirtualAccount(graphPersonId);

      // Create wallet in database
      const newWallet = await this.prisma.wallet.create({
        data: {
          userId: userId,
          currency: Currency.USD,
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

      this.logger.log(
        `USD virtual account created successfully for user ${userId}`,
      );

      return {
        message: 'USD virtual account created successfully',
        data: walletData,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create USD virtual account for user ${userId}: ${error.message}`,
        error,
      );

      if (error.code === 'P2002') {
        throw new ConflictException(
          'USD virtual account already exists for this user',
        );
      }

      throw new BadRequestException(
        'Failed to create USD virtual account. Please try again later.',
      );
    }
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
