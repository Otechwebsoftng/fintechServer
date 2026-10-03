import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomLogger } from 'src/custom.logger';
import { PrismaService } from 'src/prisma/prisma.service';
import { ObiexService } from 'src/vendors/obiex.finance';
import { CryptoAddressDto } from './dto/create.address.dto';

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

  async createCryptoAddress(payload: CryptoAddressDto): Promise<any> {
    console.log(
      'Creating crypto address with payload from the service:',
      payload,
    );
    // 1. check if userAlready has an address for the currency and network
    const addressExists = await this.getOne({
      where: {
        userId: payload.uniqueUserIdentifier,
        currency: payload.currency,
        network: payload.network,
      },
    });

    console.log('Address exists:', addressExists);

    if (addressExists) {
      return {
        message: `${payload.currency} address already exists`,
        data: addressExists,
      };
    }

    const obiexData = await this.obiexService.createDepositAddress({
      currency: payload.currency,
      network: payload.network,
      uniqueUserIdentifier: payload.uniqueUserIdentifier,
    });

    console.log('Obiex data received:', obiexData);

    return this.prisma.cryptoAddress.create({
      data: {
        userId: payload.uniqueUserIdentifier,
        walletAddress: obiexData.data.value,
        active: obiexData.data.active,
        currency: payload.currency,
        network: payload.network,
      },
    });
  }
}
