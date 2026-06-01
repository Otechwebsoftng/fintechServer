import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common';
import {
  Currency,
  PaymentEntry,
  PaymentStatus,
  Prisma,
  WalletStatus,
  WalletType,
} from '@prisma/client';
import { CustomLogger } from 'src/custom.logger';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { FundWalletDto } from './dto/fund.dto';
import { GraphService } from 'src/vendors/graph.service';
import { ResolveBankDto } from './dto/resolveBankDto';
import { Utility } from 'src/helpers/utilities.service';
import { InterNGNPayoutDto } from './dto/interNGNPayout.dto';
import { InternalPayoutDestinationDto } from './dto/internalPayoutDestination.dto';
import { SwiftPayoutDto } from './dto/swiftPayout.dto';
// import { SwiftPayoutDto } from './dto/swiftPayout.dto';

@Injectable()
export class WalletService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly logger: CustomLogger,
    private graphService: GraphService,
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
                iban: accountData.iban,
                bankName: accountData.bank_name,
                bankCode: accountData.bank_code,
                swiftCode: accountData.swift_code,
                routingNumber: accountData.routing_number,
                beneficiaryAddress: accountData.beneficiary_address,
                bankAddress: accountData.bank_address,
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
          bankAddress: responseWallet.bankAddress,
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

  // 1a. Payout by Tag (Internal)
  async internalPayoutByTag(
    userId: string,
    payload: InternalPayoutDestinationDto,
  ) {
    const receiver = await this.usersService.getOne({ userTag: payload.tag });
    if (!receiver) throw new NotFoundException('Recipient tag not found');

    const destinationWallet = await this.getOne({
      userId: receiver.id,
      currency: payload.currencyTo,
    });
    if (!destinationWallet) throw new NotFoundException('Wallet not found');

    return this.processUserTagTransfer(
      userId,
      payload,
      destinationWallet,
      true,
    );
  }
  // 1b. THE CORE WORKER FOR USER TAG PAYMENT
  private async processUserTagTransfer(
    userId: string,
    payload: InternalPayoutDestinationDto,
    destinationWallet: any | null,
    isInternal: boolean,
  ) {
    const reference = payload.reference;
    const debitAmount = Utility.CurrencyBroken(payload.amount);

    // 1. Idempotency & Validation
    if (debitAmount <= 0)
      throw new BadRequestException('Amount must be greater than zero');
    if (reference) {
      const existing = await this.getOneWalletTransaction({ reference });
      if (existing?.status === PaymentStatus.SUCCESS)
        return { message: 'Already completed', data: existing };
      if (existing?.status === PaymentStatus.PENDING)
        throw new ConflictException('Transaction is already processing');
    }

    // 2. Source & Rate Logic
    const sourceWallet = await this.getOne({
      userId,
      currency: payload.currencyFrom,
    });
    if (!sourceWallet) throw new NotFoundException('Source wallet not found');

    let creditAmount = debitAmount;

    if (payload.currencyFrom !== payload.currencyTo) {
      const rates = await this.graphService.fetchRates();

      const rate = rates.data[`${payload.currencyFrom}-${payload.currencyTo}`];
      if (!rate) throw new BadRequestException('Currency pair not supported');

      creditAmount = Utility.CurrencyBroken(payload.amount * rate);
    }

    // 3. Security Check
    const isPinValid = await this.usersService.verifyTransactionPin(
      userId,
      payload.transactionPin,
    );
    if (!isPinValid) throw new BadRequestException('Invalid transaction PIN');

    // --- STEP 1: DB LEDGER ENTRIES (Atomic) ---
    const walletIds = [sourceWallet.id, destinationWallet?.id]
      .filter(Boolean)
      .sort();
    const { senderTx, receiverTx, senderPayment, receiverPayment } =
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Wallet" WHERE id = ANY(${walletIds}) FOR UPDATE`;

        const balance = await this.getBalanceForWalletInTransaction(
          tx,
          sourceWallet.id,
        );

        if (debitAmount > balance)
          throw new BadRequestException('Insufficient balance');

        // Create Sender Record
        const sPayment = await tx.payment.create({
          data: {
            userId,
            virtualAccountId: sourceWallet.virtualAccountId,
            amount: debitAmount,
            status: PaymentStatus.PENDING,
            paymentEntry: PaymentEntry.DEBIT,
            reference,
            description: payload.description || 'Payout',
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
            description: sPayment.description,
          },
        });

        let rTx = null,
          rPayment = null;
        if (isInternal && destinationWallet) {
          rPayment = await tx.payment.create({
            data: {
              userId: destinationWallet.userId,
              virtualAccountId: destinationWallet.virtualAccountId,
              amount: creditAmount,
              status: PaymentStatus.PENDING,
              paymentEntry: PaymentEntry.CREDIT,
              reference,
              description:
                payload.description ||
                `Received from ${sourceWallet.user.firstName}`,
            },
          });
          rTx = await tx.walletTransaction.create({
            data: {
              walletId: destinationWallet.id,
              amount: creditAmount,
              currency: payload.currencyTo,
              transactionType: PaymentEntry.CREDIT,
              status: PaymentStatus.PENDING,
              reference,
              linkedTxId: sTx.id,
              paymentId: rPayment.id,
              description: `Received from ${sourceWallet.user.firstName}`,
            },
          });
        }

        return {
          senderTx: sTx,
          receiverTx: rTx,
          senderPayment: sPayment,
          receiverPayment: rPayment,
        };
      });

    // --- STEP 2: EXTERNAL PROVIDER CALL ---
    try {
      const payoutData = this.buildInternalPayoutPayload(
        sourceWallet,
        destinationWallet,
        payload.currencyTo,
        payload.currencyFrom,
        isInternal,
      );
      const dest = await this.graphService.payoutDestination(payoutData);
      const response = await this.graphService.payout({
        destination_id: dest.id,
        amount: creditAmount,
        description: payload.description,
        idempotency_key: reference,
      });

      // Update with Provider IDs
      await this.prisma.$transaction([
        this.prisma.walletTransaction.update({
          where: { id: senderTx.id },
          data: { payoutId: response?.transaction.payout_id },
        }),
        ...(receiverTx
          ? [
              this.prisma.walletTransaction.update({
                where: { id: receiverTx.id },
                data: { payoutId: response?.transaction.payout_id },
              }),
            ]
          : []),
        this.prisma.payment.update({
          where: { id: senderPayment.id },
          data: { transactionId: response?.transaction.id },
        }),
        ...(receiverPayment
          ? [
              this.prisma.payment.update({
                where: { id: receiverPayment.id },
                data: { transactionId: response?.transaction.id },
              }),
            ]
          : []),
      ]);

      return {
        message: 'Payout initiated; awaiting confirmation',
        response,
        debitTxId: senderTx.id,
      };
    } catch (error) {
      this.logger.error('TRANSFER_WORKER_CRASH', error);

      if (error.code?.startsWith('P')) {
        throw new InternalServerErrorException(
          `Database Error: ${error.code}. Check provider for reference ${reference}`,
        );
      }

      const statusCode = error.status || error.response?.status;
      const isDefinitive = statusCode >= 400 && statusCode < 500;
      if (isDefinitive && statusCode !== 408) {
        await this.executeFullReversal(
          senderTx,
          senderPayment,
          sourceWallet,
          destinationWallet,
          debitAmount,
          creditAmount,
          reference,
          receiverTx,
          receiverPayment,
        );
        const remoteMessage = error.message || 'Payout failed';
        throw new BadRequestException(
          `${remoteMessage}. Funds have been reversed.`,
        );
      }
      throw new RequestTimeoutException(
        'Processing with bank. Please check history shortly.',
      );
    }
  }

  // 2a. Inter-Bank: External Payout (Same Currency, e.g., NGN to NGN Zenith/Access)
  async interBankPayout(userId: string, payload: InterNGNPayoutDto) {
    const resolveDetails = await this.graphService.resolveBank({
      currency: payload.currencyTo,
      account_number: payload.accountNumber,
      bank_code: payload.bankCode,
    });

    payload.beneficiary = resolveDetails.account_name;

    const newPayload = {
      ...payload,
      beneficiary: payload.beneficiary,
    };

    const destinationWallet = resolveDetails;

    return this.processInterNGNTransfer(userId, newPayload, destinationWallet);
  }

  private async processInterNGNTransfer(
    userId: string,
    payload: any,
    destinationWallet: any | null,
  ) {
    const reference = payload.reference;
    const debitAmount = Utility.CurrencyBroken(payload.amount);

    // 1. Idempotency & Validation
    if (debitAmount <= 0)
      throw new BadRequestException('Amount must be greater than zero');
    if (reference) {
      const existing = await this.getOneWalletTransaction({ reference });
      if (existing?.status === PaymentStatus.SUCCESS)
        return { message: 'Already completed', data: existing };
      if (existing?.status === PaymentStatus.PENDING)
        throw new ConflictException('Transaction is already processing');
    }

    // 2. Source & Rate Logic
    const sourceWallet = await this.getOne({
      userId,
      currency: payload.currencyFrom,
    });
    if (!sourceWallet) throw new NotFoundException('Source wallet not found');

    let creditAmount = debitAmount;

    if (sourceWallet.currency !== payload.currencyTo) {
      throw new BadRequestException(
        'Invalid account selection. Only NGN to NGN is allowed',
      );
    }

    creditAmount = Utility.nairaToKobo(payload.amount);

    // 3. Security Check
    const isPinValid = await this.usersService.verifyTransactionPin(
      userId,
      payload.transactionPin,
    );
    if (!isPinValid) throw new BadRequestException('Invalid transaction PIN');

    // --- STEP 1: DB LEDGER ENTRIES (Atomic) ---
    const { senderTx, senderPayment } = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Wallet" WHERE id = ${sourceWallet.id} FOR UPDATE`;

        const balance = await this.getBalanceForWalletInTransaction(
          tx,
          sourceWallet.id,
        );

        if (debitAmount > balance)
          throw new BadRequestException('Insufficient balance');

        // Create Sender Record
        const sPayment = await tx.payment.create({
          data: {
            userId,
            virtualAccountId: sourceWallet.virtualAccountId,
            amount: debitAmount,
            currency: payload.currencyFrom,
            status: PaymentStatus.PENDING,
            paymentEntry: PaymentEntry.DEBIT,
            reference,
            description: payload.description || 'Payout',
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
            description: sPayment.description,
          },
        });

        return {
          senderTx: sTx,
          senderPayment: sPayment,
        };
      },
    );

    // --- STEP 2: EXTERNAL PROVIDER CALL ---
    try {
      const payoutData = {
        account_id: sourceWallet.virtualAccountId,
        account_type: 'personal',
        source_type: 'bank_account',
        destination_type: 'bank_account',
        label: 'Inter Bank Payout',
        type: 'nip',
        bank_code: payload.bankCode,
        account_number: payload.accountNumber,
        beneficiary_name: payload.beneficiary,
      };

      const dest = await this.graphService.payoutDestination(payoutData);
      const response = await this.graphService.payout({
        destination_id: dest.id,
        amount: creditAmount,
        description: payload.description,
        idempotency_key: reference,
      });

      // Update with Provider IDs
      await this.prisma.$transaction([
        this.prisma.walletTransaction.update({
          where: { id: senderTx.id },
          data: { payoutId: response?.transaction.payout_id },
        }),

        this.prisma.payment.update({
          where: { id: senderPayment.id },
          data: { transactionId: response?.transaction.id },
        }),
      ]);

      return {
        message: 'Payout initiated, awaiting confirmation',
        response,
        debitTxId: senderTx.id,
      };
    } catch (error) {
      const statusCode = error.status || error.response?.status;
      const isDefinitive = statusCode >= 400 && statusCode < 500;
      if (isDefinitive) {
        await this.executeFullReversal(
          senderTx,
          senderPayment,
          sourceWallet,
          destinationWallet,
          debitAmount,
          creditAmount,
          reference,
        );
        // Use the actual error message from the provider if available
        const remoteMessage = error.message || 'Payout failed';
        throw new BadRequestException(
          `${remoteMessage}. Funds have been reversed.`,
        );
      }
      throw new RequestTimeoutException(
        'Processing with bank. Please check history shortly.',
      );
    }
  }

  // 1b. Payout outside graph environment for foreign accounts
  async ForeignBankPayout(userId: string, payload: SwiftPayoutDto) {
    const sourceWallet = await this.getOne({
      userId,
      currency: payload.currencyFrom,
    });

    const destinationWallet = {
      account_id: sourceWallet.virtualAccountId,
      source_type: 'bank_account',
      label: 'Wire Payout',
      type: 'wire',
      wire_type: 'swift',
      destination_type: 'bank_account',
      account_type: 'personal',
      account_number: payload.accountNumber,
      routing_number: payload.routingNumber,
      bank_name: payload.bankName,
      beneficiary_name: payload.beneficiaryName,
      beneficiary_address: {
        line1: payload.beneficiaryAddress,
        city: payload.beneficiaryAddress,
        state: payload.beneficiaryAddress,
        country: payload.beneficiaryAddress,
        postal_code: payload.beneficiaryAddress,
      },
      bank_address: payload.bankAddress,
    };

    return this.processSwiftTransfer(userId, payload, destinationWallet);
  }

  private async processSwiftTransfer(
    userId: string,
    payload: SwiftPayoutDto,
    destinationWallet: any | null,
  ) {
    const reference = payload.reference;
    const debitAmount = Utility.CurrencyBroken(payload.amount);

    // 1. Idempotency & Validation
    if (debitAmount <= 0)
      throw new BadRequestException('Amount must be greater than zero');
    if (reference) {
      const existing = await this.getOneWalletTransaction({ reference });
      if (existing?.status === PaymentStatus.SUCCESS)
        return { message: 'Already completed', data: existing };
      if (existing?.status === PaymentStatus.PENDING)
        throw new ConflictException('Transaction is already processing');
    }

    // 2. Source & Rate Logic
    const sourceWallet = await this.getOne({
      userId,
      currency: payload.currencyFrom,
    });
    if (!sourceWallet) throw new NotFoundException('Source wallet not found');

    let creditAmount = debitAmount;

    if (payload.currencyFrom !== payload.currencyTo) {
      const rates = await this.graphService.fetchRates();

      const rate = rates.data[`${payload.currencyFrom}-${payload.currencyTo}`];
      if (!rate) throw new BadRequestException('Currency pair not supported');

      creditAmount = Utility.CurrencyBroken(payload.amount * rate);
    }

    // 3. Security Check
    const isPinValid = await this.usersService.verifyTransactionPin(
      userId,
      payload.transactionPin,
    );
    if (!isPinValid) throw new BadRequestException('Invalid transaction PIN');

    // --- STEP 1: DB LEDGER ENTRIES (Atomic) ---
    const { senderTx, senderPayment } = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Wallet" WHERE id = ${sourceWallet.id} FOR UPDATE`;

        const balance = await this.getBalanceForWalletInTransaction(
          tx,
          sourceWallet.id,
        );

        if (debitAmount > balance)
          throw new BadRequestException('Insufficient balance');

        // Create Sender Record
        const sPayment = await tx.payment.create({
          data: {
            userId,
            virtualAccountId: sourceWallet.virtualAccountId,
            amount: debitAmount,
            status: PaymentStatus.PENDING,
            paymentEntry: PaymentEntry.DEBIT,
            reference,
            description: payload.description || 'Payout',
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
            description: sPayment.description,
          },
        });

        return {
          senderTx: sTx,
          senderPayment: sPayment,
        };
      },
    );

    // --- STEP 2: EXTERNAL PROVIDER CALL ---
    try {
      const payoutData = this.buildWirePayoutPayload(
        sourceWallet,
        destinationWallet,
      );
      const dest = await this.graphService.payoutDestination(payoutData);
      const response = await this.graphService.payout({
        destination_id: dest.id,
        amount: creditAmount,
        description: payload.description,
        idempotency_key: reference,
      });

      // Update with Provider IDs
      await this.prisma.$transaction([
        this.prisma.walletTransaction.update({
          where: { id: senderTx.id },
          data: { payoutId: response?.transaction.payout_id },
        }),

        this.prisma.payment.update({
          where: { id: senderPayment.id },
          data: { transactionId: response?.transaction.id },
        }),
      ]);

      return {
        message: 'Payout initiated; awaiting confirmation',
        response,
        debitTxId: senderTx.id,
      };
    } catch (error) {
      const isDefinitive =
        error.response?.status >= 400 && error.response?.status < 500;
      if (isDefinitive) {
        await this.executeFullReversal(
          senderTx,
          senderPayment,
          sourceWallet,
          destinationWallet,
          debitAmount,
          creditAmount,
          reference,
        );
        throw new BadRequestException('Payout failed and funds returned');
      }
      throw new RequestTimeoutException(
        'Processing with bank. Please check history shortly.',
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
      where: {
        walletId: wallet.id,
        transactionType: PaymentEntry.CREDIT,
        status: PaymentStatus.SUCCESS,
      },
      _sum: { amount: true },
    });

    const walletDebit = await this.prisma.walletTransaction.aggregate({
      where: {
        walletId: wallet.id,
        transactionType: PaymentEntry.DEBIT,
        status: {
          in: [PaymentStatus.SUCCESS, PaymentStatus.PENDING],
        },
      },
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

  async history(
    userId: string,
    currencyFilter?: Currency,
    page?: number,
    pageSize?: number,
  ) {
    if (!currencyFilter || !Object.values(Currency).includes(currencyFilter)) {
      throw new BadRequestException(
        `Invalid or missing currency filter. Expected one of: ${Object.values(Currency).join(', ')}`,
      );
    }

    const shouldPaginate = !!(
      page &&
      pageSize &&
      !isNaN(Number(page)) &&
      !isNaN(Number(pageSize))
    );
    const skip = shouldPaginate ? (Number(page) - 1) * Number(pageSize) : 0;
    const take = shouldPaginate ? Number(pageSize) : undefined;

    const wallet = await this.getOne({ userId, currency: currencyFilter });
    if (!wallet) {
      throw new NotFoundException(
        `Wallet ledger context not found for user under currency: ${currencyFilter}`,
      );
    }

    const whereClause: Prisma.WalletTransactionWhereInput = {
      walletId: wallet.id,
      currency: currencyFilter,
      isDeleted: false,
    };

    const [transactions, totalCount] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: whereClause,
        ...(shouldPaginate ? { skip, take } : {}),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.walletTransaction.count({ where: whereClause }),
    ]);

    const count = totalCount || 0;
    const hasNext = shouldPaginate ? skip + (take ?? count) < count : false;
    const hasPrevious = shouldPaginate ? Number(page) > 1 : false;

    return {
      pagination: {
        page: shouldPaginate ? Number(page) : 1,
        pageSize: shouldPaginate ? Number(pageSize) : count,
        hasNext,
        hasPrevious,
        count,
      },
      data: transactions,
    };
  }

  private buildInternalPayoutPayload(
    sourceWallet: any,
    destinationWallet: any | null,
    currencyTo: Currency,
    currencyFrom: Currency,
    isInternal: boolean,
  ) {
    if (isInternal && currencyFrom !== currencyTo) {
      return {
        account_id: sourceWallet.virtualAccountId,
        source_type: 'bank_account',
        label: 'Internal Payout',
        type: 'wire',
        wire_type: 'swift',
        destination_account_id: destinationWallet.virtualAccountId,
        destination_type: 'bank_account',
        account_type: 'personal',
        account_number: destinationWallet.accountNumber,
        routing_number: destinationWallet.routingNumber,
        beneficiary_name: `${destinationWallet.user.firstName} ${destinationWallet.user.lastName}`,
        beneficiary_address: {
          line1: destinationWallet.beneficiaryAddress.line1,
          city: destinationWallet.beneficiaryAddress.city,
          state: destinationWallet.beneficiaryAddress.state,
          postal_code: destinationWallet.beneficiaryAddress.postal_code,
          country: destinationWallet.beneficiaryAddress.country,
        },
        bank_name: destinationWallet.bankName,
        bank_address: {
          line1: destinationWallet.bankAddress.line1,
          city: destinationWallet.bankAddress.city,
          state: destinationWallet.bankAddress.state,
          postal_code: destinationWallet.bankAddress.postal_code,
          country: destinationWallet.bankAddress.country,
        },
      };
    }
    if (isInternal && currencyFrom === currencyTo) {
      return {
        account_id: sourceWallet.virtualAccountId,
        account_type: 'personal',
        source_type: 'wallet_account',
        label: 'Internal Payout',
        type: 'internal',
        destination_account_id: destinationWallet.virtualAccountId,
        destination_type: 'wallet_account',
        account_number: destinationWallet.accountNumber,
      };
    }
  }
  private buildWirePayoutPayload(
    sourceWallet: any,
    destinationWallet: any | null,
  ) {
    return {
      account_id: sourceWallet.virtualAccountId,
      source_type: 'wallet_account',
      label: 'Internal Payout',
      type: 'wire',
      wire_type: 'swift',
      destination_account_id: destinationWallet.virtualAccountId,
      destination_type: 'wallet_account',
      account_type: 'personal',
      account_number: destinationWallet.accountNumber,
      routing_number: destinationWallet.routingNumber,
      beneficiary_name: `${destinationWallet.user.firstName} ${destinationWallet.user.lastName}`,
      beneficiary_address: {
        line1: destinationWallet.beneficiaryAddress.line1,
        city: destinationWallet.beneficiaryAddress.city,
        state: destinationWallet.beneficiaryAddress.state,
        postal_code: destinationWallet.beneficiaryAddress.postal_code,
        country: destinationWallet.beneficiaryAddress.country,
      },
      bank_name: destinationWallet.bankName,
      bank_address: {
        line1: destinationWallet.bankAddress.line1,
        city: destinationWallet.bankAddress.city,
        state: destinationWallet.bankAddress.state,
        postal_code: destinationWallet.bankAddress.postal_code,
        country: destinationWallet.bankAddress.country,
      },
    };
  }

  private async executeFullReversal(
    senderTx: any,
    senderPayment: any,
    sourceWallet: any,
    destinationWallet: any | null,
    debitAmount: number,
    creditAmount: number,
    reference: string,
    receiverTx?: any | null,
    receiverPayment?: any | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Mark original records as FAILED
      const updatePromises = [
        tx.walletTransaction.update({
          where: { id: senderTx.id },
          data: { status: PaymentStatus.FAILED },
        }),
        tx.payment.update({
          where: { id: senderPayment.id },
          data: { status: PaymentStatus.FAILED },
        }),
      ];

      if (receiverTx) {
        updatePromises.push(
          tx.walletTransaction.update({
            where: { id: receiverTx.id },
            data: { status: PaymentStatus.FAILED },
          }),
        );
      }
      if (receiverPayment) {
        updatePromises.push(
          tx.payment.update({
            where: { id: receiverPayment.id },
            data: { status: PaymentStatus.FAILED },
          }),
        );
      }

      await Promise.all(updatePromises);

      // 2. Return funds to Sender (CREDIT)
      await tx.walletTransaction.create({
        data: {
          walletId: sourceWallet.id,
          amount: debitAmount,
          currency: sourceWallet.currency,
          transactionType: PaymentEntry.CREDIT,
          status: PaymentStatus.SUCCESS,
          reference: `REV-${reference}`,
          linkedTxId: senderTx.id,
          description: 'Reversal: Failed payout',
        },
      });

      // 3. Nullify Receiver's pending credit (DEBIT) - ONLY if it was internal
      if (destinationWallet && receiverTx) {
        await tx.walletTransaction.create({
          data: {
            walletId: destinationWallet.id,
            amount: creditAmount,
            currency: destinationWallet.currency,
            transactionType: PaymentEntry.DEBIT,
            status: PaymentStatus.SUCCESS,
            reference: `REV-${reference}`,
            linkedTxId: receiverTx.id,
            description: 'Reversal: Sender payout failed',
          },
        });
      }
    });
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
