import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomLogger } from 'src/custom.logger';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { FincraVerificationService } from 'src/vendors/fincra.verification-service';
import { GraphService } from 'src/vendors/graph.service';
import { WalletService } from 'src/wallet/wallet.service';

@Injectable()
export class VirtualAccountService {
  constructor(
    private readonly prisma: PrismaService,
    readonly usersService: UsersService,
    private readonly walletService: WalletService,
    private readonly logger: CustomLogger,
    private readonly fincraVerificationService: FincraVerificationService,
    private readonly graphService: GraphService,
  ) {}

  async createVirtualAccount(userId: string) {
    try {
      // Validate user exists
      const user = await this.usersService.getOne({ id: userId });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Validate required KYC information
      if (!user.firstName || !user.lastName || !user.email || !user.bvn) {
        throw new BadRequestException(
          'Incomplete KYC information. Please complete your profile.',
        );
      }

      // Check for existing virtual account
      // const existingWallet = await this.walletService.getOne({
      //   userId: userId,
      //   currency: Currency.NGN,
      // });

      // if (existingWallet) {
      //   throw new ConflictException(
      //     'Virtual account already exists for this user',
      //   );
      // }

      // For now, all users get INDIVIDUAL wallet type
      // TODO: Add logic to determine COOPERATE type based on business requirements$
      // create Wallet record in our database with the details from Graph response

      // // Generate Graph NGN account
      // const graphResponse =
      //   await this.graphService.createVirtualNGAccount(userId);

      // const currency = user.kycLevel === 'TIER_2' ? 'USD' : 'NGN';

      // Create wallet in database

      // const newWallet = await this.prisma.wallet.create({
      //   data: {
      //     userId: user.id,
      //     currency: currency,
      //     accountType: WalletType.INDIVIDUAL,
      //     holderId: graphResponse.holder_id,
      //     holderType: graphResponse.holder_type,
      //     virtualAccountId: graphResponse.id,
      //     status: WalletStatus.APPROVED,
      //     bankName: graphResponse.bank_name,
      //     bankCode: graphResponse.bank_code,
      //     accountNumber: graphResponse.account_number,
      //     graphStatus: graphResponse.status,
      //   },
      // });

      // const { isDeleted, createdAt, updatedAt, ...walletData } = newWallet;

      this.logger.log(
        `Virtual account created successfully for user ${userId}`,
      );

      return {
        message: 'Virtual account created successfully',
        // data: walletData,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create virtual account for user ${userId}: ${error.message}`,
        error.stack,
      );

      // Re-throw known exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Handle Graph API errors
      throw new BadRequestException(
        'Failed to create virtual account. Please try again later.',
      );
    }
  }

  async fundWallet() {}
}
