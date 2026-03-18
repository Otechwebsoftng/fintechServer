import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { WalletService } from '../wallet/wallet.service';
import { CustomLogger } from '../custom.logger';
import { AirwallexService } from '../vendors/airwallex.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AccountStatus, KycLevel, OtpType, UserType } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: any;
  let jwtService: any;
  let mailService: any;
  let walletService: any;
  let logger: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+1234567890',
    password: 'hashedPassword',
    transactionPin: 'hashedPin',
    userType: UserType.USER,
    status: AccountStatus.ACTIVE,
    isEmailVerified: true,
    isDeleted: false,
    otp: 'hashedOtp',
    otpExpiresIn: new Date(Date.now() + 10 * 60 * 1000),
    otpType: OtpType.SIGN_UP,
    verificationLevel: KycLevel.TIER_1,
    country: 'US',
    role: {
      id: 'role-1',
      name: 'User',
      permissions: [],
    },
    taxAddress: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
    };

    const mockMailService = {
      welcomeMail: jest.fn(),
      sendOtp: jest.fn(),
    };

    const mockWalletService = {
      createUserWallet: jest.fn(),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const mockAirwallexService = {
      authenticate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailService, useValue: mockMailService },
        { provide: WalletService, useValue: mockWalletService },
        { provide: CustomLogger, useValue: mockLogger },
        { provide: AirwallexService, useValue: mockAirwallexService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    mailService = module.get(MailService);
    walletService = module.get(WalletService);
    logger = module.get(CustomLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAll', () => {
    it('should return paginated users without passwords', async () => {
      const users = [
        { ...mockUser, password: 'hash1', transactionPin: 'pin1' },
        {
          ...mockUser,
          id: 'user-2',
          email: 'test2@example.com',
          password: 'hash2',
          transactionPin: 'pin2',
        },
      ];

      prismaService.user.findMany.mockResolvedValue(users);
      prismaService.user.count.mockResolvedValue(2);

      const result = await service.getAll(1, 10);

      expect(result.pagination.count).toBe(2);
      expect(result.usersWithoutPassword).toHaveLength(2);
      expect(result.usersWithoutPassword[0]).not.toHaveProperty('password');
      expect(result.usersWithoutPassword[0]).not.toHaveProperty(
        'transactionPin',
      );
    });

    it('should filter users by status', async () => {
      prismaService.user.findMany.mockResolvedValue([mockUser]);
      prismaService.user.count.mockResolvedValue(1);

      await service.getAll(1, 10, AccountStatus.ACTIVE);

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [AccountStatus.ACTIVE] },
          }),
        }),
      );
    });

    it('should filter users by search term', async () => {
      prismaService.user.findMany.mockResolvedValue([mockUser]);
      prismaService.user.count.mockResolvedValue(1);

      await service.getAll(1, 10, undefined, 'john', undefined, undefined);

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ email: expect.any(Object) }),
              expect.objectContaining({ firstName: expect.any(Object) }),
              expect.objectContaining({ lastName: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });

    it('should filter users by country', async () => {
      prismaService.user.findMany.mockResolvedValue([mockUser]);
      prismaService.user.count.mockResolvedValue(1);

      await service.getAll(1, 10, undefined, undefined, 'US', undefined);

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ country: 'US' }),
        }),
      );
    });

    it('should filter users by verification level', async () => {
      prismaService.user.findMany.mockResolvedValue([mockUser]);
      prismaService.user.count.mockResolvedValue(1);

      await service.getAll(
        1,
        10,
        undefined,
        undefined,
        undefined,
        KycLevel.TIER_1,
      );

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            verificationLevel: { in: [KycLevel.TIER_1] },
          }),
        }),
      );
    });

    it('should return users without pagination when page/pageSize not provided', async () => {
      prismaService.user.findMany.mockResolvedValue([mockUser]);
      prismaService.user.count.mockResolvedValue(1);

      const result = await service.getAll();

      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrevious).toBe(false);
    });
  });

  describe('getOne', () => {
    it('should return a user by criteria', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.getOne({ email: 'test@example.com' });

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'test@example.com' },
        }),
      );
    });

    it('should return null when user not found', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.getOne({ email: 'notfound@example.com' });

      expect(result).toBeNull();
    });
  });

  describe('viewOne', () => {
    it('should return sanitized user data', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.viewOne('user-1');

      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('transactionPin');
      expect(result).toHaveProperty('email');
    });

    it('should return NotFoundException when user not found', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.viewOne('invalid-id');

      expect(result).toBeInstanceOf(NotFoundException);
    });
  });

  describe('createUser', () => {
    const signUpDto = {
      email: 'new@example.com',
      phoneNumber: '+1234567890',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Doe',
      userType: UserType.USER,
    };

    it('should create a new user successfully', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);
      const newUser = { ...mockUser, ...signUpDto };

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback({
          user: {
            create: jest.fn().mockResolvedValue(newUser),
          },
        });
      });

      walletService.createUserWallet.mockResolvedValue(undefined);
      mailService.welcomeMail.mockResolvedValue(undefined);
      jwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.createUser(signUpDto);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('email', signUpDto.email);
      expect(mailService.welcomeMail).toHaveBeenCalled();
    });

    it('should throw ConflictException when email already exists', async () => {
      prismaService.user.findFirst
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);

      await expect(service.createUser(signUpDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when phone number already exists', async () => {
      prismaService.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser);

      await expect(service.createUser(signUpDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should handle wallet creation failure', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      prismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
        };
        walletService.createUserWallet.mockRejectedValue(
          new Error('Wallet creation failed'),
        );
        return await callback(tx);
      });

      await expect(service.createUser(signUpDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should continue if welcome email fails', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);
      const newUser = { ...mockUser, ...signUpDto };

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback({
          user: {
            create: jest.fn().mockResolvedValue(newUser),
          },
        });
      });

      walletService.createUserWallet.mockResolvedValue(undefined);
      mailService.welcomeMail.mockRejectedValue(new Error('Email failed'));
      jwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.createUser(signUpDto);

      expect(result).toHaveProperty('token');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('createUserTag', () => {
    it('should create user tag successfully', async () => {
      const userTagDto = { userTag: 'MyTag' };
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        userTag: '@mytag',
      });

      const result = await service.createUserTag('user-1', userTagDto);

      expect(result).toEqual({
        message: 'User tag created successfully',
        data: '@mytag',
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { userTag: '@mytag' },
      });
    });
  });

  describe('setTransactionPin', () => {
    it('should set transaction pin successfully', async () => {
      const pinDto = { transactionPin: 1234 };
      prismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.setTransactionPin(mockUser as any, pinDto);

      expect(result).toEqual({ message: 'Transaction pin set successfully' });
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            transactionPin: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('activateAccount', () => {
    it('should activate account with valid OTP', async () => {
      const activateDto = {
        otp: '123456',
        otpType: OtpType.SIGN_UP,
      };

      const hashedOtp = await bcrypt.hash(activateDto.otp, 10);
      const userWithOtp = {
        ...mockUser,
        otp: hashedOtp,
        status: AccountStatus.INACTIVE,
        otpExpiresIn: new Date(Date.now() + 10 * 60 * 1000),
      };

      const updatedUser = {
        ...userWithOtp,
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
        otp: null,
        otpExpiresIn: null,
        otpType: null,
      };

      prismaService.user.update.mockResolvedValue(updatedUser);
      jwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.activateAccount(
        userWithOtp as any,
        activateDto,
      );

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('data');
      expect(result.data.isEmailVerified).toBe(true);
    });

    it('should throw BadRequestException for invalid OTP type', async () => {
      const activateDto = {
        otp: '123456',
        otpType: OtpType.FORGOT_PASSWORD,
      };

      await expect(
        service.activateAccount(mockUser as any, activateDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.activateAccount(mockUser as any, activateDto),
      ).rejects.toThrow('Invalid OTP type for account activation');
    });

    it('should throw BadRequestException for incorrect OTP', async () => {
      const activateDto = {
        otp: 'wrong-otp',
        otpType: OtpType.SIGN_UP,
      };

      await expect(
        service.activateAccount(mockUser as any, activateDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendOTP', () => {
    it('should resend OTP successfully', async () => {
      const user = {
        ...mockUser,
        otpType: OtpType.SIGN_UP,
      };

      prismaService.user.update.mockResolvedValue(user);
      mailService.welcomeMail.mockResolvedValue(undefined);

      const result = await service.resendOTP(user);

      expect(result).toHaveProperty('message', 'OTP Sent Successfully');
      expect(result).toHaveProperty('data');
      expect(mailService.welcomeMail).toHaveBeenCalled();
    });

    it('should throw BadRequestException when no OTP type found', async () => {
      const user = {
        ...mockUser,
        otpType: null,
      };

      await expect(service.resendOTP(user)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resendOTP(user)).rejects.toThrow(
        'No OTP type found for the user',
      );
    });
  });

  describe('sendPasswordOtp', () => {
    it('should send password reset OTP successfully', async () => {
      const sendOtpDto = { email: 'test@example.com' };

      prismaService.user.findFirst.mockResolvedValue(mockUser);

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback({
          user: {
            update: jest.fn().mockResolvedValue({
              ...mockUser,
              otpType: OtpType.FORGOT_PASSWORD,
            }),
          },
        });
      });

      mailService.sendOtp.mockResolvedValue(undefined);

      const result = await service.sendPasswordOtp(sendOtpDto);

      expect(result).toHaveProperty(
        'message',
        'OTP sent to your email address',
      );
      expect(result).toHaveProperty('data');
      expect(mailService.sendOtp).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      const sendOtpDto = { email: 'notfound@example.com' };

      prismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.sendPasswordOtp(sendOtpDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException on transaction failure', async () => {
      const sendOtpDto = { email: 'test@example.com' };

      prismaService.user.findFirst.mockResolvedValue(mockUser);
      prismaService.$transaction.mockRejectedValue(
        new Error('Transaction failed'),
      );

      await expect(service.sendPasswordOtp(sendOtpDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('passwordOtpVerify', () => {
    it('should verify OTP successfully', async () => {
      const verifyDto = {
        otp: '123456',
        otpType: OtpType.FORGOT_PASSWORD,
      };

      const hashedOtp = await bcrypt.hash(verifyDto.otp, 10);
      const userWithOtp = {
        ...mockUser,
        otp: hashedOtp,
      };

      prismaService.user.findFirst.mockResolvedValue(userWithOtp);

      const result = await service.passwordOtpVerify(verifyDto);

      expect(result).toEqual({ message: 'OTP verified successfully' });
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      const verifyDto = {
        otp: 'wrong-otp',
        otpType: OtpType.FORGOT_PASSWORD,
      };

      prismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.passwordOtpVerify(verifyDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('softDelete', () => {
    it('should soft delete user successfully', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        isDeleted: true,
      });

      const result = await service.softDelete('user-1');

      expect(result).toBe('Account temporarily deleted...');
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: {
            isDeleted: true,
            status: AccountStatus.INACTIVE,
          },
        }),
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.softDelete('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const resetDto = {
        email: 'test@example.com',
        password: 'newPassword123',
      };

      const hashedOtp = await bcrypt.hash('123456', 10);
      const userWithOtp = {
        ...mockUser,
        otp: hashedOtp,
        otpType: OtpType.FORGOT_PASSWORD,
        otpExpiresIn: new Date(Date.now() + 10 * 60 * 1000),
      };

      prismaService.user.findFirst.mockResolvedValue(userWithOtp);
      prismaService.user.update.mockResolvedValue({
        ...userWithOtp,
        password: 'newHashedPassword',
        otp: null,
        otpExpiresIn: null,
        otpType: null,
      });

      const result = await service.resetPassword(resetDto, '123456');

      expect(result).toEqual({ message: 'Password reset successfully' });
      expect(prismaService.user.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      const resetDto = {
        email: 'notfound@example.com',
        password: 'newPassword123',
      };

      prismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword(resetDto, '123456')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when OTP is expired', async () => {
      const resetDto = {
        email: 'test@example.com',
        password: 'newPassword123',
      };

      const userWithExpiredOtp = {
        ...mockUser,
        otpType: OtpType.FORGOT_PASSWORD,
        otpExpiresIn: new Date(Date.now() - 10 * 60 * 1000),
      };

      prismaService.user.findFirst.mockResolvedValue(userWithExpiredOtp);

      await expect(service.resetPassword(resetDto, '123456')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resetPassword(resetDto, '123456')).rejects.toThrow(
        'OTP has expired',
      );
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      const resetDto = {
        email: 'test@example.com',
        password: 'newPassword123',
      };

      const hashedOtp = await bcrypt.hash('123456', 10);
      const userWithOtp = {
        ...mockUser,
        otp: hashedOtp,
        otpType: OtpType.FORGOT_PASSWORD,
        otpExpiresIn: new Date(Date.now() + 10 * 60 * 1000),
      };

      prismaService.user.findFirst.mockResolvedValue(userWithOtp);

      await expect(
        service.resetPassword(resetDto, 'wrong-otp'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resetPassword(resetDto, 'wrong-otp'),
      ).rejects.toThrow('Invalid OTP');
    });
  });

  describe('sanitizeUser', () => {
    it('should remove sensitive fields from user object', () => {
      const result = service.sanitizeUser(mockUser);

      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('transactionPin');
      expect(result).not.toHaveProperty('isDeleted');
      expect(result).not.toHaveProperty('otp');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('firstName');
    });

    it('should return empty object when user is null', () => {
      const result = service.sanitizeUser(null);

      expect(result).toEqual({});
    });

    it('should return empty object when user is undefined', () => {
      const result = service.sanitizeUser(undefined);

      expect(result).toEqual({});
    });
  });
});
