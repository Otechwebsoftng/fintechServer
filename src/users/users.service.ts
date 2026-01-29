import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AccountStatus, KycLevel, User, UserType } from '@prisma/client';
import { ActivateAccountDto } from './dto/activateAccount.dto';
import APIFeatures from 'src/utils/apiFeatures.utils';
import { JwtService } from '@nestjs/jwt';
import { MailService } from 'src/mail/mail.service';
import { CustomLogger } from 'src/custom.logger';
import { SendPasswordOtpDto } from './dto/sendPasswordOtp.dto';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import * as bcrypt from 'bcrypt';
import { SignUpDto } from './dto/signup.dto';
import { TransactionPinDto } from './dto/transactionPin.dto';
import { WalletService } from 'src/wallet/wallet.service';
import { isEmail } from 'class-validator';
const PASSWORD_SALT = 10;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
    private readonly logger: CustomLogger,
  ) {}

  async getAll(
    page?: number,
    pageSize?: number,
    status?: AccountStatus,
    search?: string,
    country?: string,
    verificationLevel?: KycLevel,
  ) {
    const shouldPaginate =
      page && pageSize && !isNaN(Number(page)) && !isNaN(Number(pageSize));

    const skip = shouldPaginate ? (page - 1) * pageSize : 0;
    const take = shouldPaginate ? pageSize : undefined;

    const baseWhere: any = {
      userType: UserType.USER,
      status: status,
    };

    const whereClause: any = { ...baseWhere };

    if (status) {
      const statusArray = status.split(',').map((s) => s.trim().toUpperCase());

      // Filter out any invalid statuses
      const validStatuses = statusArray.filter((s) =>
        Object.values(AccountStatus).includes(s as AccountStatus),
      );

      if (validStatuses.length > 0) {
        // Use the 'in' operator to filter by multiple statuses
        whereClause.status = { in: validStatuses as AccountStatus[] };
      }
    }
    if (search) {
      whereClause.OR = [
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search,

            mode: 'insensitive',
          },
        },
      ];
    }
    if (verificationLevel) {
      const levelArray = verificationLevel
        .split(',')
        .map((s) => s.trim().toUpperCase());

      // Filter out any invalid levels
      const validLevels = levelArray.filter((s) =>
        Object.values(KycLevel).includes(s as KycLevel),
      );

      if (validLevels.length > 0) {
        // Use the 'in' operator to filter by multiple levels
        whereClause.verificationLevel = { in: validLevels as KycLevel[] };
      }
    }

    if (country) {
      whereClause.country = country;
    }
    const [users, count] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        skip,
        take,
        include: {
          role: { select: { name: true } },
        },
      }),
      this.prisma.user.count({
        where: whereClause,
      }),
    ]);
    const hasNext = shouldPaginate ? skip + (take ?? count) < count : false;
    const hasPrevious = shouldPaginate ? page > 1 : false;

    const usersWithoutPassword = users.map((user) => {
      const {
        password: _,
        transactionPin,
        isDeleted,
        isEmailVerified,
        otp,
        ...userWithoutPassword
      } = user;
      return userWithoutPassword;
    });

    return {
      pagination: {
        page: page,
        pageSize: pageSize,
        hasNext,
        hasPrevious,
        count,
      },
      usersWithoutPassword,
    };
  }

  async getOne(criteria: any) {
    return await this.prisma.user.findFirst({
      where: { ...criteria },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            permissions: true,
          },
        },
      },
    });
  }

  async viewOne(userId: string) {
    const user = await this.getOne({ id: userId });

    if (!user) {
      return new NotFoundException('User not found');
    }

    const sanitizedUser = this.sanitizeUser(user);
    return sanitizedUser;
  }

  async createUser(payload: SignUpDto) {
    const { email, phoneNumber } = payload;

    const [emailExist, phoneExist] = await Promise.all([
      this.getOne({ email }),
      this.getOne({ phoneNumber: phoneNumber }),
    ]);

    if (emailExist) {
      throw new ConflictException('Email address already in use');
    }
    if (phoneExist) {
      throw new ConflictException('Phone number already in use');
    }

    const salt = PASSWORD_SALT;
    const hashPassword = await bcrypt.hash(payload.password, salt);

    const otp = await APIFeatures.generateOtp();

    const newUser = await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          ...payload,
          password: hashPassword,
          otp: otp.token,
          otpExpiresIn: otp.otpExpires,
          userType: payload.userType || UserType.USER,
        },
      });

      // Create wallets for user (NGN and USD by default)
      try {
        await this.walletService.createUserWallet(user.id, tx);
      } catch (walletError) {
        this.logger.error('Wallet creation failed during signup', walletError);
        throw new BadRequestException('Failed to create user wallets');
      }

      return user;
    });

    try {
      await this.mailService.welcomeMail(
        newUser.email,
        newUser.firstName ?? '',
        otp.token,
      );
    } catch (err) {
      // Log but don't throw - user is already created successfully
      this.logger.error('Welcome email failed to send', err);
    }

    const token = await APIFeatures.assignJwtToken(newUser, this.jwtService);
    const result = {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      phoneNumber: newUser.phoneNumber,
      isEmailVerified: newUser.isEmailVerified,
    };

    return {
      token,
      data: result,
    };
  }

  async setTransactionPin(user: User, payload: TransactionPinDto) {
    const { transactionPin } = payload;

    const hashPin = await bcrypt.hash(transactionPin.toString(), PASSWORD_SALT);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { transactionPin: hashPin },
    });

    return { message: 'Transaction pin set successfully' };
  }

  async activateAccount(user: User, activateAccountDto: ActivateAccountDto) {
    const { otp } = activateAccountDto;
    const currentTime = new Date();
    
    const findUser = await this.getOne({
      id: user.id,
      otp: otp,
      otpExpiresIn: {
        gte: new Date(currentTime.getTime()),
      },
    });

    if (!findUser) {
      throw new BadRequestException('Expired or incorrect "OTP"');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otp: null,
        otpExpiresIn: null,
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
      },
    });
    const result = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phoneNumber: updatedUser.phoneNumber,
      isEmailVerified: updatedUser.isEmailVerified,
    };

    const token = await APIFeatures.assignJwtToken(result, this.jwtService);
    return { token, data: result };
  }

  async resendOTP(user) {
    const otp = await APIFeatures.generateOtp();
    const userData = await this.prisma.user.update({
      where: { email: user.email },
      data: { otp: otp.token, otpExpiresIn: otp.otpExpires },
    });

    await this.mailService.welcomeMail(user.email, user.username, otp.token);

     const result = {
      id: userData.id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phoneNumber: userData.phoneNumber,
      isEmailVerified: userData.isEmailVerified,
    };

    return { message: 'OTP Sent Successfully', data: result };
  }

  async sendPasswordOtp(payload: SendPasswordOtpDto) {
    const user = await this.getOne({ email: payload.email, status: 'ACTIVE' });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    const otp = await APIFeatures.generateOtp();

    const { email, firstName } = user;

    const update = await this.prisma.user.update({
      where: {
        email: payload.email,
      },
      data: {
        otp: otp.token,
        otpExpiresIn: otp.otpExpires,
      },
    });

    try {
      await this.mailService.sendOtp(email, firstName ?? '', otp.token);
    } catch (err) {
      this.logger.log('Email not sent', err);
      throw new BadRequestException('Email not sent');
    }

    const userData = this.sanitizeUser(update);

    return { message: 'OTP sent to your email address', data: userData };
  }

  async passwordOtpVerify(otp: number) {
    const currentTime = new Date();
    const user = await this.getOne({ otp, otpExpiresIn: { gte: currentTime } });

    if (!user) {
      throw new BadRequestException('Expired or incorrect "OTP"');
    }

    return { message: 'OTP verified successfully' };
  }

  async softDelete(userId: string) {
    const user = await this.getOne({ id: userId, isDeleted: false });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const result = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        isDeleted: true,
        status: AccountStatus.INACTIVE,
      },
    });

    return 'Account temporarily deleted...';
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto, otp: number) {
    const { password } = resetPasswordDto;
    const currentTime = new Date();

    const salt = 10;
    const hashPassword = await bcrypt.hash(password, salt);

    const isTokenValid = await this.prisma.user.findFirst({
      where: {
        otp: otp,
        otpExpiresIn: {
          gte: new Date(currentTime.getTime()),
        },
      },
    });

    if (!isTokenValid) throw new NotFoundException('Invalid token');

    const newPassword = await this.prisma.user.update({
      where: {
        email: isTokenValid.email,
        otp: otp,
      },
      data: {
        password: hashPassword,
        otp: null,
        otpExpiresIn: null,
      },
    });

    const {
      password: _,
      transactionPin: __,
      isDeleted,
      ...userWithoutPassword
    } = newPassword;

    return userWithoutPassword;
  }

  sanitizeUser(user) {
    if (!user) return {};
    const {
      isEmailVerified,
      password,
      transactionPin,
      isDeleted,
      otp,
      status,
      isAdminPasswordChanged,
      beneficiaries,
      createdUsers,
      updatedUsers,
      ...sanitizedUser
    } = user;
    return sanitizedUser;
  }
}
