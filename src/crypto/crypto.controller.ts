import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CryptoService } from './crypto.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateCryptoAddressDto } from './dto/create.crypto.address.dto';

@ApiTags('Crypto Currency')
@ApiBearerAuth('JWT-auth')
@Controller('crypto')
export class CryptoController {
  constructor(private readonly cryptoService: CryptoService) {}

  @Post('/create-deposit-addresses')
  @ApiOperation({ summary: 'Create deposit addresses for a user' })
  @UseGuards(AuthGuard())
  async createDepositAddresses(@Body() payload: CreateCryptoAddressDto[]) {
    return this.cryptoService.createCryptoAddress(payload);
  }
}
