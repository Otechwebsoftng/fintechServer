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
  PaymentStatus,
  WalletStatus,
  WalletType,
} from '@prisma/client';
import { CustomLogger } from 'src/custom.logger';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { FundWalletDto } from './dto/fund.dto';
import { GraphService } from 'src/vendors/graph.service';
import { PayoutDestinationDto } from './dto/payout.dto';

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
  async getOneWalletTransaction(criteria: any) {
    return await this.prisma.walletTransaction.findFirst({
      where: { ...criteria },
    });
  }

  async viewAccountDetails(
    userId: string,
    accountNumber: string,
    currency: Currency,
  ) {
    if (!accountNumber || !currency) {
      throw new BadRequestException('Account number and currency are required');
    }
    const result = await this.getOne({ userId, accountNumber, currency });
    console.log('Account details result:', result);
    if (!result) {
      throw new NotFoundException('Account not found');
    }
    return {
      message: 'Account details retrieved successfully',
      data: {
        accountNumber: result.accountNumber,
        bankName: result.bankName,
        bankCode: result.bankCode,
        swiftCode: result.swiftCode,
        routingNumber: result.routingNumber,
        beneficiaryAddress: result.beneficiaryAddress,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
      },
    };
  }

  async getUserWallets(userId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
    });

    if (wallets.length === 0) {
      throw new NotFoundException('No wallets found for this user');
    }

    const walletsByCurrency = {};

    for (const wallet of wallets) {
      try {
        let responseWallet = wallet;

        if (!wallet.accountNumber || !wallet.bankName || !wallet.bankCode) {
          // Only fetch from Graph API if data is missing
          const graphAccount = await this.graphService.getVirtualAccount(
            wallet.virtualAccountId,
          );

          if (graphAccount.status === 'success' && graphAccount.data) {
            const accountData = graphAccount.data;
            responseWallet = await this.prisma.wallet.update({
              where: { id: wallet.id },
              data: {
                graphStatus: accountData.status,
                accountNumber: accountData.account_number,
                bankName: accountData.bank_name,
                bankCode: accountData.bank_code,
                swiftCode: accountData.swift_code,
                routingNumber: accountData.routing_number,
                beneficiaryAddress: accountData.beneficiary_address,
                settlementConfig: accountData.settlement_config,
              },
            });
          }
        }

        walletsByCurrency[responseWallet.currency] = {
          walletId: responseWallet.id,
          userId: responseWallet.userId,
          virtualAccountId: responseWallet.virtualAccountId,
          accountType: responseWallet.accountType,
          currency: responseWallet.currency,
          accountNumber: responseWallet.accountNumber,
          iban: responseWallet.iban,
          bankName: responseWallet.bankName,
          bankCode: responseWallet.bankCode,
          graphStatus: responseWallet.graphStatus,
          swiftCode: responseWallet.swiftCode,
          routingNumber: responseWallet.routingNumber,
          beneficiaryAddress: responseWallet.beneficiaryAddress,
          settlementConfig: responseWallet.settlementConfig,
        };
      } catch (error) {
        this.logger.error(
          `Error fetching graph account for wallet ${wallet.id}`,
          error,
        );
      }
    }

    return walletsByCurrency;
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
  //Wallet creation ends here.

  async fundOwnWallet(userId: string, payload: FundWalletDto) {
    if (payload.amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const wallet = await this.getOne({ userId, currency: payload.currency });

    if (!wallet) {
      throw new NotFoundException(
        'Wallet not found for the user or specified currency',
      );
    }

    // Generate idempotency key for duplicate detection
    const idempotencyKey = payload.reference || `fund-${Date.now()}`;

    // Check if this reference already exists (idempotency)
    const existingTx = await this.prisma.walletTransaction.findUnique({
      where: { idempotencyKey: idempotencyKey },
    });

    if (existingTx) {
      if (existingTx.status === PaymentStatus.SUCCESS) {
        return {
          message: 'Wallet already funded',
          data: existingTx,
        };
      }
      if (existingTx.status === PaymentStatus.PENDING) {
        throw new BadRequestException('Transaction is already being processed');
      }
    }

    // STEP 1: Call external service to verify payment
    const graphPayload = {
      account_id: wallet.virtualAccountId,
      amount: payload.amount,
      currency: payload.currency,
      description:
        payload.description ||
        `Funding wallet with ${payload.amount} ${payload.currency}`,
      reference: payload.reference,
      sender_name: `${wallet.user.firstName} ${wallet.user.lastName}`,
    };
    let res;
    try {
      res = await this.graphService.mockFundVirtualAccount(graphPayload);
    } catch (error) {
      this.logger.error('Graph funding failed', error);
      throw new BadRequestException('Payment provider error');
    }

    if (res.status !== 'success') {
      throw new BadRequestException('Payment failed at the provider');
    }

    // STEP 2: Record in database with wallet lock to prevent concurrent operations
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 🔒 Lock wallet row (prevents concurrent fund operations)
        await tx.$queryRaw`
          SELECT id FROM "Wallet"
          WHERE id = ${wallet.id}
          FOR UPDATE
        `;

        // Double-check idempotency within transaction
        const existing = await tx.walletTransaction.findFirst({
          where: { idempotencyKey: idempotencyKey },
        });
        if (existing) {
          return existing;
        }

        const payment = await tx.payment.create({
          data: {
            userId: userId,
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
            idempotencyKey: idempotencyKey,
            status: PaymentStatus.SUCCESS,
          },
        });

        return { payment, walletTransaction };
      });

      return {
        message: 'Wallet funded successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error('Failed to record wallet funding', error);
      throw new BadRequestException(
        'Payment succeeded but failed to record in wallet. Please contact support.',
      );
    }
  }

  // async internalPayout(userId: string, payload: PayoutDestinationDto) {
  //   if (payload.amount <= 0) {
  //     throw new BadRequestException('Amount must be greater than zero');
  //   }

  //   const [sourceWallet, destinationWallet] = await Promise.all([
  //     this.getOne({
  //       userId,
  //       currency: payload.currency,
  //     }),
  //     this.getOne({
  //       accountNumber: payload.accountNumber,
  //       currency: payload.currency,
  //     }),
  //   ]);

  //   if (!sourceWallet) {
  //     throw new NotFoundException(
  //       'Wallet not found for the user or specified currency',
  //     );
  //   }

  //   if (!destinationWallet) {
  //     throw new NotFoundException('Destination wallet not found');
  //   }

  //   const result = await this.prisma.$transaction(async (tx) => {
  //     // Re-fetch wallet within transaction for atomicity and check balance
  //     // This prevents race conditions with concurrent payout requests
  //     const walletInTx = await tx.wallet.findFirstOrThrow({
  //       where: { userId, currency: payload.currency },
  //     });

  //     // Calculate balance within transaction (atomic check)
  //     const balance = await this.getBalanceForWalletInTransaction(
  //       tx,
  //       walletInTx.id,
  //     );

  //     if (payload.amount > balance) {
  //       throw new BadRequestException('Insufficient wallet balance');
  //     }

  //     // Create payout destination with Graph service
  //     const payoutDestinationDetails = {
  //       account_id: sourceWallet.virtualAccountId,
  //       source_type: 'bank_account',
  //       label: 'Internal Payout',
  //       type: 'internal',
  //       destinationId: destinationWallet.virtualAccountId,
  //       destination_type: 'bank_account',
  //       bank_code: destinationWallet.bankCode,
  //       account_number: destinationWallet.accountNumber,
  //     };

  //     const createPayoutResponse = await this.graphService.payoutDestination(
  //       payoutDestinationDetails,
  //     );

  //     // Initiate the actual payout
  //     const payoutPayload = {
  //       destination_id: createPayoutResponse.id,
  //       amount: payload.amount,
  //       description:
  //         payload.description ||
  //         `Payout to ${destinationWallet.user.firstName} ${destinationWallet.user.lastName}`,
  //     };

  //     const payoutResponse = await this.graphService.payout(payoutPayload);

  //     // Record the transaction in database
  //     await tx.walletTransaction.create({
  //       data: {
  //         walletId: walletInTx.id,
  //         amount: payload.amount,
  //         currency: payload.currency,
  //         transactionType: PaymentEntry.DEBIT,
  //         description: payoutResponse.description,
  //         reference: payoutResponse.organisation_id,
  //         status:
  //           payoutResponse.status === 'pending'
  //             ? PaymentStatus.PENDING
  //             : payoutResponse.status === 'success'
  //               ? PaymentStatus.SUCCESS
  //               : PaymentStatus.FAILED,
  //       },
  //     });

  //     return createPayoutResponse;
  //   });

  //   return {
  //     message: 'Payout created successfully',
  //     data: result,
  //   };
  // }

  //Get wallet balance for a user and currency

  async internalPayout(userId: string, payload: PayoutDestinationDto) {
    if (payload.amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }
    const reference = payload.reference;

    if (reference) {
      const existingTx = await this.getOneWalletTransaction({ reference });

      if (existingTx) {
        if (existingTx.status === PaymentStatus.SUCCESS) {
          return { message: 'Payout already completed', data: existingTx };
        }
        if (existingTx.status === PaymentStatus.PENDING) {
          throw new BadRequestException(
            'Transaction is already being processed',
          );
        }
      }
    }

    const [sourceWallet, destinationWallet] = await Promise.all([
      this.getOne({ userId, currency: payload.currency }),
      this.getOne({
        accountNumber: payload.accountNumber,
        currency: payload.currency,
      }),
    ]);

    if (!sourceWallet) {
      throw new NotFoundException('Source wallet not found');
    }

    if (!destinationWallet) {
      throw new NotFoundException('Destination wallet not found');
    }

    // ✅ VERIFY TRANSACTION PIN FIRST (before any side effects)
    const isPinValid = await this.usersService.verifyTransactionPin(
      userId,
      payload.transactionPin,
    );
    if (!isPinValid) {
      throw new BadRequestException('Invalid transaction PIN');
    }

    // STEP 1: LOCK + LEDGER ENTRY
    const { walletTx: debitTx, creditTx } = await this.prisma.$transaction(
      async (tx) => {
        // 🔒 Lock wallet row (CRITICAL)
        await tx.$queryRaw`
        SELECT id FROM "Wallet"
        WHERE id = ${sourceWallet.id}
        FOR UPDATE
      `;

        // ✅ Safe balance calculation
        const balance = await this.getBalanceForWalletInTransaction(
          tx,
          sourceWallet.id,
        );

        if (payload.amount > balance) {
          throw new BadRequestException('Insufficient balance');
        }

        // 🧾 Create PENDING debit for source wallet
        const debitTx = await tx.walletTransaction.create({
          data: {
            walletId: sourceWallet.id,
            amount: payload.amount,
            currency: payload.currency,
            transactionType: PaymentEntry.DEBIT,
            status: PaymentStatus.PENDING,
            reference: reference, // Same reference for matching
            description:
              payload.description ||
              `Payout to ${destinationWallet.user.firstName} ${destinationWallet.user.lastName}`,
          },
        });

        // 🧾 Create PENDING credit for destination wallet
        const creditTx = await tx.walletTransaction.create({
          data: {
            walletId: destinationWallet.id,
            amount: payload.amount,
            currency: payload.currency,
            transactionType: PaymentEntry.CREDIT,
            status: PaymentStatus.PENDING,
            reference: reference, // Same reference for audit trail
            linkedTxId: debitTx.id, // Link to source debit
            description: `Received from ${sourceWallet.user.firstName} ${sourceWallet.user.lastName}`,
          },
        });

        return { walletTx: debitTx, creditTx };
      },
    );

    // STEP 2: EXTERNAL CALL
    let payoutResponse;

    try {
      const payoutDestination = await this.graphService.payoutDestination({
        account_id: sourceWallet.virtualAccountId,
        source_type: 'bank_account',
        label: 'Internal Payout',
        type: 'internal',
        destination_account_id: destinationWallet.virtualAccountId,
        destination_type: 'bank_account',
        bank_code: destinationWallet.bankCode,
        account_number: destinationWallet.accountNumber,
      });

      payoutResponse = await this.graphService.payout({
        destination_id: payoutDestination.id,
        amount: payload.amount,
        description: debitTx.description,
        idempotency_key: reference,
      });

      // STEP 3: MARK SUCCESS (both debit and credit)
      await this.prisma.$transaction([
        this.prisma.walletTransaction.update({
          where: { id: debitTx.id },
          data: {
            status: PaymentStatus.SUCCESS,
            reference: payoutResponse.organisation_id,
          },
        }),
        this.prisma.walletTransaction.update({
          where: { id: creditTx.id },
          data: {
            status: PaymentStatus.SUCCESS,
            reference: payoutResponse.organisation_id,
          },
        }),
      ]);
    } catch (error) {
      this.logger.error('Payout failed', error);

      // STEP 4: REVERSAL ENTRY (reverse both transactions)
      await this.prisma.$transaction(async (tx) => {
        // Mark original transactions as FAILED
        await Promise.all([
          tx.walletTransaction.update({
            where: { id: debitTx.id },
            data: { status: PaymentStatus.FAILED },
          }),
          tx.walletTransaction.update({
            where: { id: creditTx.id },
            data: { status: PaymentStatus.FAILED },
          }),
        ]);

        // Create reversal CREDIT for source wallet
        await tx.walletTransaction.create({
          data: {
            walletId: sourceWallet.id,
            amount: payload.amount,
            currency: payload.currency,
            transactionType: PaymentEntry.CREDIT,
            status: PaymentStatus.SUCCESS,
            reference: debitTx.reference, // Use same reference for audit
            linkedTxId: debitTx.id,
            description: 'Reversal for failed payout',
          },
        });

        // Create reversal DEBIT for destination wallet (reverse the credit they received)
        await tx.walletTransaction.create({
          data: {
            walletId: destinationWallet.id,
            amount: payload.amount,
            currency: payload.currency,
            transactionType: PaymentEntry.DEBIT,
            status: PaymentStatus.SUCCESS,
            reference: creditTx.reference, // Use same reference
            linkedTxId: creditTx.id,
            description: 'Reversal for failed payout',
          },
        });
      });

      throw new BadRequestException('Payout failed and reversed');
    }

    return {
      message: 'Payout successful',
      data: payoutResponse,
    };
  }

  async getWalletBalance(userId: string, currency: Currency) {
    //validate currency as query param
    if (!Object.values(Currency).includes(currency)) {
      throw new BadRequestException('Invalid currency');
    }

    const wallet = await this.getOne({ userId, currency });

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
      where: { walletId, transactionType, status: PaymentStatus.SUCCESS },
      _sum: { amount: true },
    });

    return result._sum.amount ?? 0;
  }

  private async getBalanceForWalletInTransaction(
    tx: any,
    walletId: string,
  ): Promise<number> {
    const walletCredit = await tx.walletTransaction.aggregate({
      where: { walletId, transactionType: PaymentEntry.CREDIT },
      _sum: { amount: true },
    });

    const walletDebit = await tx.walletTransaction.aggregate({
      where: { walletId, transactionType: PaymentEntry.DEBIT },
      _sum: { amount: true },
    });

    const totalCredit = walletCredit._sum.amount || 0;
    const totalDebit = walletDebit._sum.amount || 0;

    return totalCredit - totalDebit;
  }
}
