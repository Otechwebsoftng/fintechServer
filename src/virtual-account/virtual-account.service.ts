import { Injectable } from '@nestjs/common';
import { request } from 'http';
import { CustomLogger } from 'src/custom.logger';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class VirtualAccountService {
  constructor(
    private readonly prisma: PrismaService,
    readonly usersService: UsersService,
    private readonly logger: CustomLogger,
  ) {}

  async createVirtualAccount(userId: string) {
    // Logic to create a virtual account for the user
    // This is a placeholder implementation and should be replaced with actual logic
    return {
      accountNumber: '1234567890',
      bankName: 'Example Bank',
      userId,
    };
  }

  async requestVirtualAccount(userId: string) {}
}
