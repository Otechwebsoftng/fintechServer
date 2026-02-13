import {
  BadRequestException,
  Body,
  Controller,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
// import { AuditLog } from 'src/audit-log/audit-log.decorator';
import { AuthGuard } from '@nestjs/passport';
import { ActivateAccountDto } from 'src/users/dto/activateAccount.dto';
import { User } from '@prisma/client';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { Request, Response } from 'express';

// @AuditLog({ model: 'user' })
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  @ApiOperation({
    summary: 'Login Users',
    description: 'Login with email and password',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);
    res.cookie('refreshToken', result.refreshToken, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: true,
    });
    return result;
  }
  @Post('/admin/login')
  @ApiOperation({
    summary: 'Login Admin Users',
    description: 'Admin Login with email and password',
  })
  async adminLogin(@Body() loginDto: LoginDto): Promise<{ token: string }> {
    return this.authService.adminLogin(loginDto);
  }

  @Patch('/admin/verify-user')
  @UseGuards(AuthGuard())
  @ApiOperation({
    summary: 'Validates verification code',
    description:
      'Validates verification code sent to admin email for admin to gain access to admin dashboard',
  })
  async verifyAdmin(
    @Body() activateAccountDto: ActivateAccountDto,
    @CurrentUser() user: User,
  ): Promise<any> {
    return this.authService.verifyAdmin(user, activateAccountDto);
  }

  @Post('/refresh-token')
  async refreshAccessToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new BadRequestException('Refresh token missing');
    }
    const userData = await this.authService.refreshAccessToken(refreshToken);
    res.cookie('refreshToken', userData.refreshToken, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    return userData;
  }
}
