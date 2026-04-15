import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Currency, User } from '@prisma/client';
import { WalletService } from './wallet.service';
import { FundWalletDto } from './dto/fund.dto';
import { Throttle } from '@nestjs/throttler';
import { PayoutDestinationDto } from './dto/payout.dto';

@ApiTags('Wallet')
@ApiBearerAuth('JWT-auth')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @ApiOperation({
    description: 'Get Wallets',
    summary: 'Get the wallets of a currently logged in user ',
  })
  @Get('/user-wallets')
  @UseGuards(AuthGuard())
  async checkKycStatus(@CurrentUser() user: User) {
    const userId = user.id;
    return this.walletService.getUserWallets(userId);
  }
  @ApiOperation({
    description: 'Get Account Details',
    summary: 'Get the details of a specific account',
  })
  @ApiQuery({
    name: 'currency',
    required: true,
    description: 'Currency of the account to fetch details for',
  })
  @ApiQuery({
    name: 'accountNumber',
    required: true,
    description: 'Account number to fetch details for',
  })
  @Get('/account-details')
  @UseGuards(AuthGuard())
  async getAccountDetails(
    @Query('accountNumber') accountNumber: string,
    @Query('currency') currency: Currency,
    @CurrentUser() user: User,
  ) {
    const userId = user.id;
    return this.walletService.viewAccountDetails(
      userId,
      accountNumber,
      currency,
    );
  }

  @ApiOperation({
    description: 'Get Wallet Balance',
    summary: 'Get the balance of a logged in user wallet',
  })
  @ApiQuery({
    name: 'Currency',
    required: true,
    description: 'Currency of the wallet to fetch balance for',
  })
  @Get('/wallet-balance')
  @UseGuards(AuthGuard())
  async getWalletBalance(
    @Query('currency') currency: Currency,
    @CurrentUser() user: User,
  ) {
    const userId = user.id;
    return this.walletService.getWalletBalance(userId, currency);
  }

  @ApiOperation({
    description: 'Fund User Wallet',
    summary: 'Fund the wallet of a logged in user',
  })
  @Post('/fund-wallet')
  @UseGuards(AuthGuard())
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  async fundWallet(@Body() payload: FundWalletDto, @CurrentUser() user: User) {
    const userId = user.id;
    return this.walletService.fundOwnWallet(userId, payload);
  }

  @ApiOperation({
    description: 'Internal Payout',
    summary: 'Initiate an internal payout from one wallet to another',
  })
  @Post('/internal-payout')
  @UseGuards(AuthGuard())
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  async internalPayout(
    @Body() payload: PayoutDestinationDto,
    @CurrentUser() user: User,
  ) {
    const userId = user.id;
    return this.walletService.internalPayout(userId, payload);
  }
}
