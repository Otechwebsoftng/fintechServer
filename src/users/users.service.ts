import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AccountStatus,
  KycLevel,
  OtpType,
  User,
  UserType,
} from '@prisma/client';
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
import { AirwallexService } from 'src/vendors/airwallex.service';
import { UserTagDto } from './dto/userTag.dto';
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
    private readonly airwallexService: AirwallexService,
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
      /* eslint-disable @typescript-eslint/no-unused-vars */
      const {
        password,
        transactionPin,
        isDeleted,
        isEmailVerified,
        otp,
        ...userWithoutPassword
      } = user;
      /* eslint-enable @typescript-eslint/no-unused-vars */
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
        taxAddress: {
          select: {
            id: true,
            country: true,
            state: true,
            city: true,
            street: true,
            houseNo: true,
            zipCode: true,
            nationality: true,
            taxCountry: true,
            taxNumber: true,
            isTaxAddressCompleted: true,
          },
        },
        wallets: {
          select: {
            id: true,
            virtualAccountId: true,
            userId: true,
            currency: true,
            bankName: true,
            accountNumber: true,
            bankCode: true,
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

    const hashOtp = await bcrypt.hash(otp.token.toString(), salt);

    const newUser = await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          ...payload,
          password: hashPassword,
          otp: hashOtp,
          otpExpiresIn: otp.otpExpires,
          userType: payload.userType || UserType.USER,
          otpType: OtpType.SIGN_UP,
        },
      });
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

    // this.airwallexService.authenticate();

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

  async createUserTag(userId: string, payload: UserTagDto) {
    const sanitizedTag = '@' + payload.userTag.toLowerCase().trim();

    try {
      const updateUserTag = await this.prisma.user.update({
        where: { id: userId },
        data: {
          userTag: sanitizedTag,
        },
      });

      return {
        message: 'User tag created successfully',
        data: updateUserTag.userTag,
      };
    } catch (error) {
      if (error.code === 'P2002' && error.meta?.target?.includes('userTag')) {
        throw new ConflictException('User tag already in use');
      }
    }
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

  async activateAccount(user: User, payload: ActivateAccountDto) {
    if (user.otp === null) {
      throw new BadRequestException('Resend OTP to activate your account');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { otp, otpType } = payload;

    if (otpType !== OtpType.SIGN_UP) {
      throw new BadRequestException('Invalid OTP type for account activation');
    }

    const currentTime = new Date();

    const decryptOtp = await bcrypt.compare(payload?.otp, user.otp);

    if (!decryptOtp) {
      throw new BadRequestException('Expired or incorrect "OTP"');
    }

    const update = await this.prisma.user.update({
      where: {
        id: user.id,
        otpType: OtpType.SIGN_UP,
        otpExpiresIn: { gte: new Date(currentTime.getTime()) },
        status: AccountStatus.INACTIVE,
      },
      data: {
        otp: null,
        otpExpiresIn: null,
        otpType: null,
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
      },
    });

    const result = {
      id: update.id,
      email: update.email,
      firstName: update.firstName,
      lastName: update.lastName,
      phoneNumber: update.phoneNumber,
      isEmailVerified: update.isEmailVerified,
    };

    const token = await APIFeatures.assignJwtToken(result, this.jwtService);
    return { token, data: result };
  }

  async resendOTP(user) {
    const otp = await APIFeatures.generateOtp();
    if (user.otpType === null) {
      throw new BadRequestException('No OTP type found for the user');
    }

    const hashOtp = await bcrypt.hash(otp.token.toString(), PASSWORD_SALT);
    const userData = await this.prisma.user.update({
      where: { email: user.email },
      data: { otp: hashOtp, otpExpiresIn: otp.otpExpires },
    });

    await this.mailService.welcomeMail(
      user.email,
      user.firstName ?? '',
      otp.token,
    );

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
    const user = await this.getOne({
      email: payload.email,
      status: 'ACTIVE',
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const otp = await APIFeatures.generateOtp();
    const hashOtp = await bcrypt.hash(otp.token.toString(), PASSWORD_SALT);

    try {
      const updatedUser = await this.prisma.$transaction(async (tx) => {
        const userWithOtp = await tx.user.update({
          where: { id: user.id },
          data: {
            otp: hashOtp,
            otpExpiresIn: otp.otpExpires,
            otpType: OtpType.FORGOT_PASSWORD,
          },
        });

        await this.mailService.sendOtp(
          user.email,
          user.firstName ?? '',
          otp.token,
        );

        return userWithOtp;
      });

      const result = {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phoneNumber: updatedUser.phoneNumber,
        isEmailVerified: updatedUser.isEmailVerified,
      };

      return {
        message: 'OTP sent to your email address',
        data: this.sanitizeUser(result),
      };
    } catch (error) {
      this.logger.error('OTP process failed', error);
      throw new BadRequestException('Failed to send password reset OTP');
    }
  }

  async passwordOtpVerify(payload: ActivateAccountDto) {
    // const currentTime = new Date();

    const hashOtp = await bcrypt.hash(payload.otp, PASSWORD_SALT);

    const user = await this.getOne({
      otp: hashOtp,
      // otpExpiresIn: { gte: new Date(currentTime.getTime()) },
    });

    if (!user) {
      throw new BadRequestException('Expired or incorrect OTP');
    }

    const decryptOtp = await bcrypt.compare(payload.otp, user.otp);

    if (!decryptOtp) {
      throw new BadRequestException('Expired or incorrect OTP');
    }

    return { message: 'OTP verified successfully' };
  }

  async softDelete(userId: string) {
    const user = await this.getOne({ id: userId, isDeleted: false });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
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

  async resetPassword(resetPasswordDto: ResetPasswordDto, otp: string) {
    const { password, email } = resetPasswordDto;
    const currentTime = new Date();

    const user = await this.getOne({
      email,
      otpType: OtpType.FORGOT_PASSWORD,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.otpExpiresIn || user.otpExpiresIn < currentTime) {
      throw new BadRequestException('OTP has expired');
    }

    const isOtpValid = await bcrypt.compare(otp, user.otp);
    if (!isOtpValid) {
      throw new BadRequestException('Invalid OTP');
    }

    const hashedPassword = await bcrypt.hash(password, PASSWORD_SALT);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        otp: null,
        otpExpiresIn: null,
        otpType: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  async verifyTransactionPin(userId: string, transactionPin: string) {
    const user = await this.sanitizeUser(
      this.prisma.user.findUnique({ where: { id: userId } }),
    );
    if (!user) {
      throw new BadRequestException(
        'You are not authorized to perform this action',
      );
    }

    if (!user.transactionPin) {
      throw new BadRequestException('Transaction PIN not set');
    }

    const isPinValid = await bcrypt.compare(
      transactionPin,
      user.transactionPin,
    );
    if (!isPinValid) {
      throw new BadRequestException('Invalid transaction PIN');
    }
    return true;
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
