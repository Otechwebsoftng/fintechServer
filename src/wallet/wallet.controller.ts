import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Currency, IdentityType, User } from '@prisma/client';
import { WalletService } from './wallet.service';
import { FundWalletDto } from './dto/fund.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @ApiOperation({
    description: 'Get Wallets',
    summary: 'Get the wallets of a currently logged in user ',
  })
  @Get('/user-wallets')
  @UseGuards(AuthGuard())
  @UseInterceptors(UseInterceptors)
  async checkKycStatus(@CurrentUser() user: User) {
    const userId = user.id;
    return this.walletService.getUserWallets(userId);
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
  @UseInterceptors(UseInterceptors)
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
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @UseInterceptors(UseInterceptors)
  async fundWallet(@Body() payload: FundWalletDto, @CurrentUser() user: User) {
    const userId = user.id;
    return this.walletService.fundOwnWallet(userId, payload);
  }
}
