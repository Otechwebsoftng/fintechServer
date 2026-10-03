import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomLogger } from 'src/custom.logger';
import { PrismaService } from 'src/prisma/prisma.service';
import { ObiexService } from 'src/vendors/obiex.finance';
import { CreateCryptoAddressDto } from './dto/create.crypto.address.dto';

@Injectable()
export class CryptoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly obiexService: ObiexService,
    private readonly logger: CustomLogger,
  ) {}

  async getOne<T extends Prisma.CryptoAddressFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.CryptoAddressFindFirstArgs>,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.CryptoAddressGetPayload<T> | null> {
    const db = tx ?? this.prisma;
    return db.cryptoAddress.findFirst(args);
  }

  async getUserCryptoWallets(userId: string): Promise<any> {
    const wallets = this.prisma.cryptoAddress.findMany({
      where: {
        userId,
      },
    });

    return {
      message: 'User crypto wallets retrieved successfully',
      data: wallets,
    };
  }

  async createCryptoAddress(payload: CreateCryptoAddressDto[]): Promise<any> {
    if (!payload.length) {
      return {
        message: 'No addresses provided in the payload',
        data: [],
      };
    }
    const results = await Promise.all(
      payload.map(async (address) => {
        const existingAddress = await this.getOne({
          where: {
            userId: address.uniqueUserIdentifier,
            currency: address.currency,
            network: address.network,
          },
        });

        // Address already exists
        if (existingAddress) {
          return {
            currency: address.currency,
            network: address.network,
            walletAddress: existingAddress.walletAddress,
            status: 'EXISTS',
          };
        }

        // Create address with Obiex
        const obiexData = await this.obiexService.createDepositAddress({
          currency: address.currency,
          network: address.network,
          uniqueUserIdentifier: address.uniqueUserIdentifier,
        });

        const createdAddress = await this.prisma.cryptoAddress.create({
          data: {
            userId: address.uniqueUserIdentifier,
            walletAddress: obiexData.data.value,
            active: obiexData.data.active,
            currency: address.currency,
            network: address.network,
          },
        });

        console.log('Obiex data received:', obiexData);

        return {
          currency: address.currency,
          network: address.network,
          walletAddress: createdAddress.walletAddress,
          status: 'CREATED',
        };
      }),
    );

    return {
      message: 'Crypto addresses processed successfully',
      data: results,
    };
  }
}
