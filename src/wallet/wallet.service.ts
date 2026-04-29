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

  // 1a. Payout by Tag (Internal)
  async internalPayoutByTag(
    userId: string,
    tag: string,
    payload: PayoutDestinationDto,
  ) {
    const receiver = await this.usersService.getOne({ userTag: tag });
    if (!receiver) throw new NotFoundException('Recipient tag not found');

    const destinationWallet = await this.getOne({
      userId: receiver.id,
      currency: payload.currencyTo,
    });
    return this.processTransfer(userId, payload, destinationWallet, true);
  }

  // 1b. Payout by Account Number (Auto-detect Internal vs External)
  async interBankPayout(userId: string, payload: PayoutDestinationDto) {
    const destinationWallet = await this.getOne({
      accountNumber: payload.accountNumber,
      currency: payload.currencyTo,
    });

    // If the wallet exists in our DB, it's Internal. Otherwise, it's External.
    const isInternal = !!destinationWallet;
    if (!isInternal && payload.currencyTo === 'NGN') {
      try {
        const resolution = await this.graphService.resolveBank({
          currency: payload.currencyTo,
          account_number: payload.accountNumber,
          bank_code: payload.bankCode, // Ensure this is in your DTO
        });
        console.log(resolution);

        // Update payload with verified data from the bank
        payload.beneficiaryName = resolution.account_name;
        // You can also verify if the bank exists here if needed
      } catch (error) {
        this.logger.error('Bank resolution failed', error);
        throw new BadRequestException('Could not verify bank account details');
      }
    }
    return this.processTransfer(userId, payload, destinationWallet, isInternal);
  }

  // 3. THE CORE WORKER (The "Joined" Logic)
  private async processTransfer(
    userId: string,
    payload: PayoutDestinationDto,
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
    const { senderTx, receiverTx, senderPayment, receiverPayment } =
      await this.prisma.$transaction(async (tx) => {
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
              description: payload.description,
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
      const payoutData = this.buildPayoutPayload(
        sourceWallet,
        destinationWallet,
        payload,
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
      const isDefinitive =
        error.response?.status >= 400 && error.response?.status < 500;
      if (isDefinitive) {
        await this.executeFullReversal(
          senderTx,
          receiverTx,
          senderPayment,
          receiverPayment,
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

  private buildPayoutPayload(
    sourceWallet: any,
    destinationWallet: any,
    payload: PayoutDestinationDto,
    isInternal: boolean,
  ) {
    // Scenario A: Internal P2P (Same Currency)
    if (isInternal && payload.currencyFrom === payload.currencyTo) {
      return {
        account_id: sourceWallet.virtualAccountId,
        source_type: 'bank_account',
        label: 'Internal Payout',
        type: 'internal',
        destination_account_id: destinationWallet.virtualAccountId,
        destination_type: 'bank_account',
        bank_code: destinationWallet.bankCode,
        account_number: destinationWallet.accountNumber,
      };
    }

    // Scenario B: Cross-Currency (e.g., USD Wire/Swift)
    if (payload.currencyFrom !== payload.currencyTo) {
      return {
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
        beneficiary_name: `${destinationWallet.user.firstName} ${destinationWallet.user.lastName}`,
        beneficiary_address: {
          line1: destinationWallet.user.taxAddress?.houseNo,
          city: destinationWallet.user.taxAddress?.city,
          state: destinationWallet.user.taxAddress?.state,
          country: destinationWallet.user.taxAddress?.country,
          postal_code: destinationWallet.user.taxAddress?.zipCode,
        },
        bank_address: destinationWallet.beneficiaryAddress,
      };
    }

    // Scenario C: External NGN Transfer (NIP)
    return {
      account_id: sourceWallet.virtualAccountId,
      account_type: 'personal',
      source_type: 'bank_account',
      label: 'Inter Bank Payout',
      type: 'nip',
      bank_code: payload.bankCode,
      account_number: destinationWallet.accountNumber,
      beneficiary_name: payload.beneficiaryName,
    };
  }

  private async executeFullReversal(
    senderTx: any,
    receiverTx: any | null,
    senderPayment: any,
    receiverPayment: any | null,
    sourceWallet: any,
    destinationWallet: any | null,
    debitAmount: number,
    creditAmount: number,
    reference: string,
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
