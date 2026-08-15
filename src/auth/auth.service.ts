import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { CustomLogger } from 'src/custom.logger';
import { AccountStatus, OtpType, User, UserType } from '@prisma/client';
import APIFeatures from 'src/utils/apiFeatures.utils';
import { ActivateAccountDto } from 'src/users/dto/activateAccount.dto';
import { Utility } from 'src/helpers/utilities.service';
import { ConfigService } from '@nestjs/config';
const PASSWORD_SALT = 10;
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly logger: CustomLogger,
    private configService: ConfigService,
  ) {}

  async login(payload: LoginDto) {
    const user = await this.usersService.getOne({
      where: { email: payload.email, userType: UserType.USER },
    });

    if (!user) throw new UnauthorizedException('Invalid email or password');

    const isPasswordMatch = await bcrypt.compare(
      payload.password,
      user.password,
    );

    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const result = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      isEmailVerified: user.isEmailVerified,
      expiredAt: user.expiryDate,
    };

    return await this.getUserAuthData(result);
  }

  async adminLogin(loginDto: LoginDto) {
    const user = await this.usersService.getOne({
      where: { email: loginDto.email, userType: UserType.ADMIN },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
            permissions: {
              select: {
                permissionId: true,
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Invalid email or Password!');

    const isPasswordMatch = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === AccountStatus.INACTIVE) {
      throw new BadRequestException(
        'User account is inactive. Contact support.',
      );
    }

    const token = await APIFeatures.assignJwtToken(user, this.jwtService);

    const result = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      isEmailVerified: user.isEmailVerified,
      role: user.role,
      isAdminPasswordChanged: user.isAdminPasswordChanged,
    };

    const otp = await APIFeatures.generateOtp();
    const hashOtp = await bcrypt.hash(otp.token.toString(), PASSWORD_SALT);

    await this.prisma.user.update({
      where: {
        email: user.email,
      },
      data: {
        otp: hashOtp,
        otpType: OtpType.ADMIN_LOGIN,
        otpExpiresIn: otp.otpExpires,
      },
    });

    void this.mailService.sendOtp(user.email, user.firstName ?? '', otp.token);

    return { token, data: result };
  }

  async verifyAdmin(user: User, activateAccountDto: ActivateAccountDto) {
    try {
      if (activateAccountDto.otpType !== OtpType.ADMIN_LOGIN) {
        throw new BadRequestException('Invalid OTP type');
      }

      if (!user.otp || !user.otpExpiresIn) {
        throw new BadRequestException('Expired or incorrect "OTP"');
      }

      const isValidOtp = await bcrypt.compare(activateAccountDto.otp, user.otp);

      const isExpired = new Date() > new Date(user.otpExpiresIn);

      if (!isValidOtp || isExpired) {
        throw new BadRequestException('Expired or incorrect "OTP"');
      }

      const updatedUser = await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          otp: null,
          otpExpiresIn: null,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
        },
      });

      const token = await APIFeatures.assignJwtToken(
        updatedUser,
        this.jwtService,
      );

      return {
        token,
        user: this.sanitizeUser(updatedUser),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to verify admin ${user.id}`);

      throw new InternalServerErrorException('Failed to verify admin');
    }
  }

  async getUserAuthData(user: any) {
    const refreshToken = await this.generateRefreshToken(user.id);
    const token = await APIFeatures.assignJwtToken(user, this.jwtService);
    const userWithoutPassword = this.sanitizeUser(user);
    return { user: userWithoutPassword, token, refreshToken };
  }

  async generateRefreshToken(userId: string) {
    // expire existing token
    const expiredDate = new Date().setDate(new Date().getDate() - 1);

    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { expiresAt: new Date(expiredDate).toISOString() },
    });

    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() +
        Number(this.configService.get<string>('REFRESH_TOKEN_EXPIRY')),
    );

    const token = Utility.uuid();

    const hashedToken = Utility.hashString(token);

    await this.prisma.refreshToken.create({
      data: { hashedToken, userId, expiresAt },
    });

    return token;
  }

  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new BadRequestException('Invalid refresh token');
    }

    const hashedToken = Utility.hashString(refreshToken);
    const token = await this.prisma.refreshToken.findUnique({
      where: { hashedToken },
    });
    if (!token) {
      throw new BadRequestException('Invalid refresh token');
    }

    if (token.expiresAt.getTime() < new Date().getTime()) {
      throw new BadRequestException('Refresh token has expired');
    }

    const user = await this.usersService.getOne({
      where: { id: token.userId },
    });

    if (!user) throw new NotFoundException('User not found');

    const userWithoutPassword = this.sanitizeUser(user);

    await this.prisma.refreshToken.delete({
      where: { id: token.id },
    });

    return this.getUserAuthData(userWithoutPassword);
  }

  sanitizeUser(user) {
    if (!user) return {};
    const { password, isDeleted, transactionPin, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}
