import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { ResolveBankDto } from './dto/resolveBankDto';
import { InternalPayoutDestinationDto } from './dto/internalPayoutDestination.dto';
import { InterNGNPayoutDto } from './dto/interNGNPayout.dto';
import { SwiftPayoutDto } from './dto/swiftPayout.dto';

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
  async getUserWallets(@CurrentUser() user: User) {
    const userId = user.id;
    return this.walletService.getUserWallets(userId);
  }

  @Get('/history')
  @ApiOperation({
    description: ' Fetch Transaction History',
    summary: 'Fetch transaction history of a logged in user',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Number of users to return per page',
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    enum: Currency,
    description: 'Filter transaction history by currency',
  })
  @UseGuards(AuthGuard())
  async getAllUsers(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('currency') currency?: Currency,
  ) {
    const userId = user.id;
    return this.walletService.history(userId, currency, page, pageSize);
  }

  @ApiOperation({
    description: 'Get Banks',
    summary: 'Get the list of available banks',
  })
  @Get('/list-banks')
  @UseGuards(AuthGuard())
  async fetchBanks() {
    return this.walletService.fetchBanks();
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

  // @ApiOperation({
  //   description: 'Internal Payout',
  //   summary:
  //     'Initiate an internal payout from one wallet to another regardless of the currency',
  // })
  // @Post('/internal-payout')
  // @UseGuards(AuthGuard())
  // @Throttle({ short: { limit: 3, ttl: 60000 } })
  // async internalPayout(
  //   @Body() payload: PayoutDestinationDto,
  //   @CurrentUser() user: User,
  // ) {
  //   const userId = user.id;
  //   return this.walletService.interBankPayout(userId, payload);
  // }

  @ApiOperation({
    description: 'Inter Nigeria bank transfer',
    summary:
      'Initiate an inter bank transfer from graph wallet to external NGN banks eg Zenith, Access',
  })
  @Post('/inter-bank-transfer')
  @UseGuards(AuthGuard())
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  async externalPayout(
    @Body() payload: InterNGNPayoutDto,
    @CurrentUser() user: User,
  ) {
    const userId = user.id;
    return this.walletService.interBankPayout(userId, payload);
  }

  @ApiOperation({
    description: 'Payout by user tags',
    summary:
      'Initiate an internal payout from one wallet to another via user tag',
  })
  @Post('/fund-user-tag')
  @UseGuards(AuthGuard())
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  async internalPayoutByTag(
    @Body() payload: InternalPayoutDestinationDto,
    @CurrentUser() user: User,
  ) {
    const userId = user.id;
    return this.walletService.internalPayoutByTag(userId, payload);
  }

  @ApiOperation({
    description: 'Wire Payout',
    summary: 'Initiate an Wire payout from one wallet to another via user tag',
  })
  @Post('/fund-user-tag')
  @UseGuards(AuthGuard())
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  async WireTransfer(
    @Body() payload: SwiftPayoutDto,
    @CurrentUser() user: User,
  ) {
    const userId = user.id;
    return this.walletService.ForeignBankPayout(userId, payload);
  }

  @ApiOperation({
    description: 'Resolve Bank Details',
    summary: 'Resolve bank details for a given account number',
  })
  @Post('/resolve-bank-details')
  @UseGuards(AuthGuard())
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  async ResolveBankDetails(@Body() payload: ResolveBankDto) {
    return this.walletService.resolveBank(payload);
  }
}
