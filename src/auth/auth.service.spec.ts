import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { CustomLogger } from '../custom.logger';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AccountStatus, OtpType, UserType } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: any;
  let prismaService: any;
  let mailService: any;
  let logger: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    password: '$2a$10$hashedPassword',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+1234567890',
    userType: UserType.USER,
    status: AccountStatus.ACTIVE,
    isEmailVerified: true,
    isDeleted: false,
    otp: null,
    otpExpiresIn: null,
    otpType: null,
    transactionPin: 'hashedPin',
    role: {
      id: 'role-1',
      name: 'User',
      permissions: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdmin = {
    ...mockUser,
    id: 'admin-1',
    email: 'admin@example.com',
    userType: UserType.ADMIN,
    isAdminPasswordChanged: true,
    role: {
      id: 'admin-role',
      name: 'Admin',
      permissions: ['admin.access'],
    },
  };

  beforeEach(async () => {
    const mockUsersService = {
      getOne: jest.fn(),
    };

    const mockPrismaService = {
      user: {
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const mockMailService = {
      sendOtp: jest.fn(),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('604800'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailService, useValue: mockMailService },
        { provide: CustomLogger, useValue: mockLogger },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    prismaService = module.get(PrismaService);
    mailService = module.get(MailService);
    logger = module.get(CustomLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should successfully login a user with valid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      usersService.getOne.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      prismaService.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      prismaService.refreshToken.create.mockResolvedValue({
        id: 'token-1',
        hashedToken: 'hashed',
        userId: mockUser.id,
        expiresAt: new Date(),
      });

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).not.toHaveProperty('password');
      expect(usersService.getOne).toHaveBeenCalledWith(
        expect.objectContaining({
          email: loginDto.email,
          userType: UserType.USER,
        }),
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      const loginDto = {
        email: 'notfound@example.com',
        password: 'password123',
      };

      usersService.getOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(NotFoundException);
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid email or Password!',
      );
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      usersService.getOne.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid email or password',
      );
    });
  });

  describe('adminLogin', () => {
    it('should successfully login an admin and send OTP', async () => {
      const loginDto = {
        email: 'admin@example.com',
        password: 'adminpass123',
      };

      usersService.getOne.mockResolvedValue(mockAdmin);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedOtp' as never);
      prismaService.user.update.mockResolvedValue(mockAdmin);
      mailService.sendOtp.mockResolvedValue(undefined);

      const result = await service.adminLogin(loginDto);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('role');
      expect(usersService.getOne).toHaveBeenCalledWith(
        expect.objectContaining({
          email: loginDto.email,
          userType: UserType.ADMIN,
        }),
      );
      expect(prismaService.user.update).toHaveBeenCalled();
      expect(mailService.sendOtp).toHaveBeenCalled();
    });

    it('should throw NotFoundException when admin does not exist', async () => {
      const loginDto = {
        email: 'notadmin@example.com',
        password: 'password123',
      };

      usersService.getOne.mockResolvedValue(null);

      await expect(service.adminLogin(loginDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw UnauthorizedException when admin password is incorrect', async () => {
      const loginDto = {
        email: 'admin@example.com',
        password: 'wrongpassword',
      };

      usersService.getOne.mockResolvedValue(mockAdmin);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(service.adminLogin(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw BadRequestException when admin account is inactive', async () => {
      const loginDto = {
        email: 'admin@example.com',
        password: 'adminpass123',
      };

      const inactiveAdmin = {
        ...mockAdmin,
        status: AccountStatus.INACTIVE,
      };

      usersService.getOne.mockResolvedValue(inactiveAdmin);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await expect(service.adminLogin(loginDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.adminLogin(loginDto)).rejects.toThrow(
        'User account is inactive. Contact support.',
      );
    });

    it('should continue if email sending fails', async () => {
      const loginDto = {
        email: 'admin@example.com',
        password: 'adminpass123',
      };

      usersService.getOne.mockResolvedValue(mockAdmin);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedOtp' as never);
      prismaService.user.update.mockResolvedValue(mockAdmin);
      mailService.sendOtp.mockRejectedValue(new Error('Email failed'));

      const result = await service.adminLogin(loginDto);

      expect(result).toHaveProperty('token');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('verifyAdmin', () => {
    it('should successfully verify admin with valid OTP', async () => {
      const activateDto = {
        otp: '123456',
        otpType: OtpType.ADMIN_LOGIN,
      };

      const hashedOtp = await bcrypt.hash(activateDto.otp, 10);
      const adminWithOtp = {
        ...mockAdmin,
        otp: hashedOtp,
        otpExpiresIn: new Date(Date.now() + 10 * 60 * 1000),
      };

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      prismaService.user.findFirst.mockResolvedValue(adminWithOtp);
      prismaService.user.update.mockResolvedValue({
        ...adminWithOtp,
        otp: null,
        otpExpiresIn: null,
        isEmailVerified: true,
      });

      const result = await service.verifyAdmin(
        adminWithOtp as any,
        activateDto,
      );

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user).not.toHaveProperty('password');
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: adminWithOtp.id },
          data: expect.objectContaining({
            otp: null,
            otpExpiresIn: null,
            status: AccountStatus.ACTIVE,
            isEmailVerified: true,
          }),
        }),
      );
    });

    it('should throw BadRequestException for invalid OTP type', async () => {
      const activateDto = {
        otp: '123456',
        otpType: OtpType.SIGN_UP,
      };

      await expect(
        service.verifyAdmin(mockAdmin as any, activateDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyAdmin(mockAdmin as any, activateDto),
      ).rejects.toThrow('Invalid Otp Type');
    });

    it('should throw BadRequestException for incorrect OTP', async () => {
      const activateDto = {
        otp: 'wrongotp',
        otpType: OtpType.ADMIN_LOGIN,
      };

      const hashedOtp = await bcrypt.hash('123456', 10);
      const adminWithOtp = {
        ...mockAdmin,
        otp: hashedOtp,
      };

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.verifyAdmin(adminWithOtp as any, activateDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyAdmin(adminWithOtp as any, activateDto),
      ).rejects.toThrow('Expired or incorrect "OTP"');
    });

    it('should throw BadRequestException when OTP is expired', async () => {
      const activateDto = {
        otp: '123456',
        otpType: OtpType.ADMIN_LOGIN,
      };

      const hashedOtp = await bcrypt.hash(activateDto.otp, 10);
      const adminWithExpiredOtp = {
        ...mockAdmin,
        otp: hashedOtp,
        otpExpiresIn: new Date(Date.now() - 10 * 60 * 1000),
      };

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      prismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyAdmin(adminWithExpiredOtp as any, activateDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserAuthData', () => {
    it('should return user data with tokens', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      prismaService.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      prismaService.refreshToken.create.mockResolvedValue({
        id: 'token-1',
        hashedToken: 'hashed',
        userId: user.id,
        expiresAt: new Date(),
      });

      const result = await service.getUserAuthData(user);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).not.toHaveProperty('password');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate and store a new refresh token', async () => {
      const userId = 'user-1';

      prismaService.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      prismaService.refreshToken.create.mockResolvedValue({
        id: 'token-1',
        hashedToken: 'hashed-token',
        userId,
        expiresAt: new Date(),
      });

      const result = await service.generateRefreshToken(userId);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
        }),
      );
      expect(prismaService.refreshToken.create).toHaveBeenCalled();
    });

    it('should expire existing tokens before creating new one', async () => {
      const userId = 'user-1';

      prismaService.refreshToken.updateMany.mockResolvedValue({ count: 2 });
      prismaService.refreshToken.create.mockResolvedValue({
        id: 'token-1',
        hashedToken: 'hashed-token',
        userId,
        expiresAt: new Date(),
      });

      await service.generateRefreshToken(userId);

      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId },
        data: expect.objectContaining({
          expiresAt: expect.any(String),
        }),
      });
    });
  });

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token with valid refresh token', async () => {
      const refreshToken = 'valid-refresh-token';
      const hashedToken = 'hashed-token';

      const mockRefreshToken = {
        id: 'token-1',
        hashedToken,
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      prismaService.refreshToken.findUnique.mockResolvedValue(mockRefreshToken);
      usersService.getOne.mockResolvedValue(mockUser);
      prismaService.refreshToken.delete.mockResolvedValue(mockRefreshToken);
      prismaService.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      prismaService.refreshToken.create.mockResolvedValue({
        id: 'new-token-1',
        hashedToken: 'new-hashed',
        userId: mockUser.id,
        expiresAt: new Date(),
      });

      const result = await service.refreshAccessToken(refreshToken);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(prismaService.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: mockRefreshToken.id },
      });
    });

    it('should throw BadRequestException when refresh token is not provided', async () => {
      await expect(service.refreshAccessToken(null)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.refreshAccessToken(null)).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should throw BadRequestException when refresh token does not exist', async () => {
      const refreshToken = 'invalid-token';

      prismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should throw BadRequestException when refresh token is expired', async () => {
      const refreshToken = 'expired-token';

      const expiredToken = {
        id: 'token-1',
        hashedToken: 'hashed',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      };

      prismaService.refreshToken.findUnique.mockResolvedValue(expiredToken);

      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
        'Refresh token has expired',
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      const refreshToken = 'valid-refresh-token';

      const mockRefreshToken = {
        id: 'token-1',
        hashedToken: 'hashed',
        userId: 'nonexistent-user',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      prismaService.refreshToken.findUnique.mockResolvedValue(mockRefreshToken);
      usersService.getOne.mockResolvedValue(null);

      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('sanitizeUser', () => {
    it('should remove sensitive fields from user object', () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashedPassword',
        transactionPin: 'hashedPin',
        isDeleted: false,
        firstName: 'John',
      };

      const result = service.sanitizeUser(user);

      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('transactionPin');
      expect(result).not.toHaveProperty('isDeleted');
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
