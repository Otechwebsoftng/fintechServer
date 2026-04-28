import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  RequestTimeoutException,
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
import { ResolveBankDto } from './dto/resolveBankDto';
import { Utility } from 'src/helpers/utilities.service';

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
            email: true,
            taxAddress: true,
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
    const inputAmount = Utility.CurrencyBroken(payload.amount);
    if (inputAmount <= 0) {
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
      amount: inputAmount,
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
            amount: inputAmount,
            currency: payload.currency,
            description: payload.description,
            reference: payload.reference,
            paymentMethod: payload.paymentMethod,
          },
        });

        const walletTransaction = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: inputAmount,
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

  // 1. ENTRY POINT: Payout by Tag
  async internalPayoutByTag(
    userId: string,
    tag: string,
    payload: PayoutDestinationDto,
  ) {
    const userByTag = await this.usersService.getOne({ userTag: tag });
    if (!userByTag)
      throw new NotFoundException('No user found with the specified tag');

    const destinationWallet = await this.getOne({
      userId: userByTag.id,
      currency: payload.currencyTo,
    });

    return this.processInternalTransfer(userId, destinationWallet, payload);
  }

  // 2. ENTRY POINT: Payout by Account Number
  async internalPayout(userId: string, payload: PayoutDestinationDto) {
    const destinationWallet = await this.getOne({
      accountNumber: payload.accountNumber,
      currency: payload.currencyTo,
    });

    return this.processInternalTransfer(userId, destinationWallet, payload);
  }

  // 3. THE CORE WORKER (The "Joined" Logic)
  private async processInternalTransfer(
    userId: string,
    destinationWallet: any,
    payload: PayoutDestinationDto,
  ) {
    const amountValueConversion = Utility.CurrencyBroken(payload.amount);

    if (amountValueConversion <= 0)
      throw new BadRequestException('Amount must be greater than zero');
    if (!destinationWallet)
      throw new NotFoundException('Destination wallet not found');

    const reference = payload.reference;

    // --- Idempotency Check ---
    if (reference) {
      const existingTx = await this.getOneWalletTransaction({ reference });
      if (existingTx) {
        if (existingTx.status === PaymentStatus.SUCCESS)
          return { message: 'Payout already completed', data: existingTx };
        if (existingTx.status === PaymentStatus.PENDING)
          throw new ConflictException(
            'Duplicate transaction reference. Already processing.',
          );
      }
    }

    // --- Source Wallet & Rate Conversion ---
    const sourceWallet = await this.getOne({
      userId,
      currency: payload.currencyFrom,
    });
    if (!sourceWallet) throw new NotFoundException('Source wallet not found');

    let creditAmount = payload.amount;

    if (payload.currencyFrom !== payload.currencyTo) {
      // Get Rates
      const rates = await this.graphService.fetchRates();
      const rate = rates.data[`${payload.currencyFrom}-${payload.currencyTo}`];

      if (!rate) throw new BadRequestException('Currency pair not supported');
      creditAmount = Utility.CurrencyBroken(payload.amount * rate);
    }

    const debitAmount = Utility.CurrencyBroken(payload.amount);

    // --- Security Check ---
    const isPinValid = await this.usersService.verifyTransactionPin(
      userId,
      payload.transactionPin,
    );
    if (!isPinValid) throw new BadRequestException('Invalid transaction PIN');

    // --- STEP 1: DB LEDGER ENTRIES ---
    const { senderTx, receiverTx, senderPayment, receiverPayment } =
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Wallet" WHERE id = ${sourceWallet.id} FOR UPDATE`;
        const balance = await this.getBalanceForWalletInTransaction(
          tx,
          sourceWallet.id,
        );
        if (debitAmount > balance)
          throw new BadRequestException('Insufficient balance');

        const desc =
          payload.description ||
          `Payout to ${destinationWallet.user.firstName} ${destinationWallet.user.lastName}`;

        const sPayment = await tx.payment.create({
          data: {
            userId,
            virtualAccountId: sourceWallet.virtualAccountId,
            amount: debitAmount,
            status: PaymentStatus.PENDING,
            paymentEntry: PaymentEntry.DEBIT,
            reference,
            description: desc,
          },
        });
        const sTx = await tx.walletTransaction.create({
          data: {
            walletId: sourceWallet.id,
            amount: debitAmount,
            currency: payload.currencyFrom,
            transactionType: PaymentEntry.DEBIT,
            status: PaymentStatus.PENDING,
            reference,
            paymentId: sPayment.id,
            description: desc,
          },
        });
        const rPayment = await tx.payment.create({
          data: {
            userId: destinationWallet.userId,
            virtualAccountId: destinationWallet.virtualAccountId,
            amount: creditAmount,
            status: PaymentStatus.PENDING,
            paymentEntry: PaymentEntry.CREDIT,
            reference,
            description: payload.description,
          },
        });
        const rTx = await tx.walletTransaction.create({
          data: {
            walletId: destinationWallet.id,
            amount: creditAmount,
            currency: payload.currencyTo,
            transactionType: PaymentEntry.CREDIT,
            status: PaymentStatus.PENDING,
            reference,
            linkedTxId: sTx.id,
            paymentId: rPayment.id,
            description: `Received from ${sourceWallet.user.firstName} ${sourceWallet.user.lastName}`,
          },
        });

        return {
          senderTx: sTx,
          receiverTx: rTx,
          senderPayment: sPayment,
          receiverPayment: rPayment,
        };
      });

    // --- STEP 2: EXTERNAL API CALL & ERROR HANDLING ---

    const usdPayoutDestination = {
      account_id: sourceWallet.virtualAccountId,
      source_type: 'bank_account',
      label: 'Wire Payout',
      type: 'wire',
      wire_type: 'swift',
      destination_type: 'bank_account',
      account_type: 'personal',
      account_number: destinationWallet.accountNumber,
      routing_number: destinationWallet.routingNumber,
      bank_name: destinationWallet.bankName,
      beneficiary_name: `${destinationWallet.user.firstName + ' ' + destinationWallet.user.lastName}`,
      beneficiary_address: {
        line1: destinationWallet.user.taxAddress.houseNo,
        city: destinationWallet.user.taxAddress.city,
        state: destinationWallet.user.taxAddress.state,
        country: destinationWallet.user.taxAddress.country,
        postal_code: destinationWallet.user.taxAddress.zipCode,
      },
      bank_address: destinationWallet.beneficiaryAddress,
    };

    const internalPayoutDestinationSameCurrency = {
      account_id: sourceWallet.virtualAccountId,
      source_type: 'bank_account',
      label: 'Internal Payout',
      type: 'internal',
      destination_account_id: destinationWallet.virtualAccountId,
      destination_type: 'bank_account',
      bank_code: destinationWallet.bankCode,
      account_number: destinationWallet.accountNumber,
    };

    // const interBankTransferNGN = {
    //   account_id: sourceWallet.virtualAccountId,
    //   source_type: 'bank_account',
    //   label: 'Inter Bank Payout',
    //   type: 'nip',
    //   destination_account_id: destinationWallet.virtualAccountId,
    //   destination_type: 'bank_account',
    //   bank_code: destinationWallet.bankCode,
    //   account_number: destinationWallet.accountNumber,
    // };
    let payoutData: any;
    if (payload.currencyFrom === payload.currencyTo) {
      payoutData = internalPayoutDestinationSameCurrency;
    } else if (payload.currencyFrom !== payload.currencyTo) {
      payoutData = usdPayoutDestination;
    }
    try {
      // const payoutDestination = await this.graphService.payoutDestination({
      //   account_id: sourceWallet.virtualAccountId,
      //   source_type: 'bank_account',
      //   label: 'Internal Payout',
      //   type: 'internal',
      //   destination_account_id: destinationWallet.virtualAccountId,
      //   destination_type: 'bank_account',
      //   bank_code: destinationWallet.bankCode,
      //   account_number: destinationWallet.accountNumber,
      // });

      const payoutDestination =
        await this.graphService.payoutDestination(payoutData);

      const payoutResponse = await this.graphService.payout({
        destination_id: payoutDestination.id,
        amount: creditAmount,
        description: payload.description,
        idempotency_key: reference,
      });

      await this.prisma.$transaction([
        this.prisma.walletTransaction.update({
          where: { id: senderTx.id },
          data: { payoutId: payoutResponse?.transaction.payout_id },
        }),
        // this.prisma.walletTransaction.update({
        //   where: { id: receiverTx.id },
        //   data: { payoutId: payoutResponse?.transaction.payout_id },
        // }),
        this.prisma.payment.update({
          where: { id: senderPayment.id },
          data: { transactionId: payoutResponse?.transaction.id },
        }),
        // this.prisma.payment.update({
        //   where: { id: receiverPayment.id },
        //   data: { transactionId: payoutResponse?.transaction.id },
        // }),
      ]);

      return {
        message: 'Payout initiated; awaiting confirmation',
        payoutResponse,
        debitTxId: senderTx.id,
        creditTxId: receiverTx.id,
      };
    } catch (error) {
      this.logger.error(`Payout error for ref: ${reference}`, error);
      const isDefinitive =
        error.response?.status >= 400 && error.response?.status < 500;

      if (isDefinitive) {
        await this.prisma.$transaction(async (tx) => {
          await Promise.all([
            tx.walletTransaction.update({
              where: { id: senderTx.id },
              data: { status: PaymentStatus.FAILED },
            }),
            tx.walletTransaction.update({
              where: { id: receiverTx.id },
              data: { status: PaymentStatus.FAILED },
            }),
            tx.payment.update({
              where: { id: senderPayment.id },
              data: {
                status: PaymentStatus.FAILED,
                failure_reason: error.message,
              },
            }),
            tx.payment.update({
              where: { id: receiverPayment.id },
              data: {
                status: PaymentStatus.FAILED,
                failure_reason: 'Sender payout failed',
              },
            }),
          ]);

          await tx.walletTransaction.create({
            data: {
              walletId: sourceWallet.id,
              amount: debitAmount,
              currency: payload.currencyFrom,
              transactionType: PaymentEntry.CREDIT,
              status: PaymentStatus.SUCCESS,
              reference: `REV-${reference}`,
              linkedTxId: senderTx.id,
              description: 'Reversal: Failed payout',
            },
          });
          await tx.walletTransaction.create({
            data: {
              walletId: destinationWallet.id,
              amount: creditAmount,
              currency: payload.currencyTo,
              transactionType: PaymentEntry.DEBIT,
              status: PaymentStatus.SUCCESS,
              reference: `REV-${reference}`,
              linkedTxId: receiverTx.id,
              description: 'Reversal: Sender payout failed',
            },
          });
        });
        throw new BadRequestException('Payout failed and funds returned.');
      }

      throw error;

      throw new RequestTimeoutException(
        'Transaction processing. Check history in a few minutes.',
      );
    }
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

  async resolveBank(payload: ResolveBankDto) {
    try {
      const res = await this.graphService.resolveBank({
        currency: payload.currency,
        account_number: payload.accountNumber,
        bank_code: payload.bankCode,
      });
      return {
        message: 'Bank details resolved successfully',
        data: res,
      };
    } catch (error) {
      this.logger.error('Bank resolution failed', error);
      throw new BadRequestException('Failed to resolve bank details');
    }
  }

  async fetchBanks() {
    try {
      const res = await this.graphService.listBank();
      return {
        message: 'Banks fetched successfully',
        data: res,
      };
    } catch (error) {
      this.logger.error('Fetch banks failed', error);
      throw new BadRequestException('Failed to fetch banks');
    }
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
      where: {
        walletId,
        transactionType: PaymentEntry.CREDIT,
        status: PaymentStatus.SUCCESS,
      },
      _sum: { amount: true },
    });

    const walletDebit = await tx.walletTransaction.aggregate({
      where: {
        walletId,
        transactionType: PaymentEntry.DEBIT,
        status: {
          in: [PaymentStatus.SUCCESS, PaymentStatus.PENDING],
        },
      },
      _sum: { amount: true },
    });

    const totalCredit = walletCredit._sum.amount || 0;
    const totalDebit = walletDebit._sum.amount || 0;

    return totalCredit - totalDebit;
  }
}
