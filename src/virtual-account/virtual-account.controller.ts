import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { VirtualAccountService } from './virtual-account.service';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@Controller('virtual-account')
export class VirtualAccountController {
  constructor(private readonly virtualAccountService: VirtualAccountService) {}

  @Post('/create')
  @ApiOperation({
    summary: 'Create Virtual Account',
    description: 'Create a virtual account for a user',
  })
  @UseGuards(AuthGuard('jwt'))
  async createVirtualAccount(@CurrentUser() user: User) {
    const userId = user.id; // Assuming the user object has an id property
    return await this.virtualAccountService.createVirtualAccount(userId);
  }
}
