import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  PayloadTooLargeException,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { AccountStatus, KycLevel, User } from '@prisma/client';
import { PermissionsGuard } from 'src/auth/guard/permission.guard';
import { Permissions } from 'src/auth/decorators/permission.decorator';
import { ActivateAccountDto } from './dto/activateAccount.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SendPasswordOtpDto } from './dto/sendPasswordOtp.dto';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { Sign } from 'crypto';
import { SignUpDto } from './dto/signup.dto';
import { TransactionPinDto } from './dto/transactionPin.dto';
import { UserTagDto } from './dto/userTag.dto';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    description: ' Fetch all users',
    summary: 'Admin can fetch all users',
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
    name: 'status',
    required: false,
    enum: AccountStatus,
    description: 'Filter users by status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search users by email, firstName or lastName',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'Filter users by country',
  })
  @ApiQuery({
    name: 'verificationLevel',
    required: false,
    enum: KycLevel,
    description: 'Filter users by verification level',
  })

  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('super_admin.full_access', 'support_admin')
  async getAllUsers(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: AccountStatus,
    @Query('search') search?: string,
    @Query('country') country?: string,
    @Query('verificationLevel') verificationLevel?: KycLevel,
  ) {
    return this.usersService.getAll(page, pageSize, status, search, country, verificationLevel);
  }

  @Patch('/set-transaction-pin')
  @UseGuards(AuthGuard())
  @ApiOperation({
    description: 'Set transaction pin for user',
    summary: 'Allows user to set a transaction pin',
  })
  async setTransactionPin(
    @Body() payload: TransactionPinDto,
    @CurrentUser() user: User,
  ): Promise<any> {
    return this.usersService.setTransactionPin(user, payload);
  }

  @Patch('/verify-user')
  @UseGuards(AuthGuard())
  @ApiOperation({
    description: 'Activate user Account',
    summary: 'Validates verification code and activates user Account',
  })
  async activateAccount(
    @Body() activateAccountDto: ActivateAccountDto,
    @CurrentUser() user: User,
  ): Promise<any> {
    return this.usersService.activateAccount(user, activateAccountDto);
  }

  @Post()
  @ApiOperation({
    description: 'Create a new user Account',
    summary: 'Signup new users',
  })
  async signup(
    @Body() payload: SignUpDto,
    @CurrentUser() user: User,
  ): Promise<{}> {
    return this.usersService.createUser(payload);
  }

  @Patch('/create-user-tag')
  @ApiOperation({
    description: 'Create a new user tag',
    summary: 'Allows user to create a user tag',
  })
  @UseGuards(AuthGuard())
  async createUserTag(
    @Body() payload: UserTagDto,
    @CurrentUser() user: User,
  ): Promise<{}> {
    return this.usersService.createUserTag(user.id, payload);
  }

  @Patch('/resend-otp')
  @ApiOperation({ summary: 'Resend OTP to a user' })
  @UseGuards(AuthGuard())
  async resendOTP(@CurrentUser() user: User): Promise<{}> {
    return this.usersService.resendOTP(user);
  }

  // ResetPassword OTP
  @Patch('forgot-password')
  @ApiOperation({
    description: 'Sends a token to an existing user',
    summary: 'Sends a token to an existing user',
  })
  async forgotPassword(@Body() payload: SendPasswordOtpDto) {
    return this.usersService.sendPasswordOtp(payload);
  }

  // Reset Password
  @Patch('verify-password-otp')
  @ApiOperation({
    description: ' Verify OTP for password reset',
    summary: 'Users can verify OTP for password reset.',
  })
  async verifyPassword(
    @Body() payload: ActivateAccountDto
  ) {
    return this.usersService.passwordOtpVerify(payload);
  }

  // Reset Password
  @Patch('reset-password/:otp')
  @ApiOperation({
    description: 'Reset user password',
    summary: 'Users can reset their password.',
  })
  async restPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Param('otp') otp: string,
  ) {
    return this.usersService.resetPassword(resetPasswordDto, otp);
  }

  // Move parameterized route to the end to avoid catching specific routes
  @Get(':userId')
  @ApiOperation({
    description: ' View a user Account',
    summary: 'Admin can view a user Account',
  })
  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('super_admin.full_access', 'support_admin')
  async viewUser(@Param('userId') userId: string) {
    return this.usersService.viewOne(userId);
  }
}
