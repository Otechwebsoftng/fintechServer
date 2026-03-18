import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { BadRequestException } from '@nestjs/common';
import { OtpType, UserType, AccountStatus } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+1234567890',
    userType: UserType.USER,
    status: AccountStatus.ACTIVE,
    isEmailVerified: true,
  };

  const mockAuthResponse = {
    user: mockUser,
    token: 'mock-jwt-token',
    refreshToken: 'mock-refresh-token',
  };

  const mockRequest = {
    cookies: {
      refreshToken: 'existing-refresh-token',
    },
  } as any;

  const mockResponse = {
    cookie: jest.fn(),
  } as any;

  beforeEach(async () => {
    const mockAuthService = {
      login: jest.fn(),
      adminLogin: jest.fn(),
      verifyAdmin: jest.fn(),
      refreshAccessToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(AuthGuard())
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should successfully login a user and set refresh token cookie', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      authService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto, mockResponse);

      expect(result).toEqual(mockAuthResponse);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        mockAuthResponse.refreshToken,
        expect.objectContaining({
          maxAge: 30 * 24 * 60 * 60 * 1000,
          httpOnly: true,
          secure: true,
        }),
      );
    });

    it('should handle login with different credentials', async () => {
      const loginDto = {
        email: 'different@example.com',
        password: 'differentpass',
      };

      const differentResponse = {
        ...mockAuthResponse,
        user: { ...mockUser, email: 'different@example.com' },
      };

      authService.login.mockResolvedValue(differentResponse);

      const result = await controller.login(loginDto, mockResponse);

      expect(result.user.email).toBe('different@example.com');
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('adminLogin', () => {
    it('should successfully login an admin', async () => {
      const loginDto = {
        email: 'admin@example.com',
        password: 'adminpass123',
      };

      const adminResponse = {
        token: 'admin-jwt-token',
        data: {
          id: 'admin-1',
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          phoneNumber: '+1234567890',
          isEmailVerified: true,
          role: {
            id: 'admin-role',
            name: 'Admin',
            permissions: ['admin.access'],
          },
          isAdminPasswordChanged: true,
        },
      };

      authService.adminLogin.mockResolvedValue(adminResponse);

      const result = await controller.adminLogin(loginDto);

      expect(result).toEqual(adminResponse);
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('data');
      expect(authService.adminLogin).toHaveBeenCalledWith(loginDto);
    });

    it('should handle admin login with role information', async () => {
      const loginDto = {
        email: 'superadmin@example.com',
        password: 'superpass',
      };

      const superAdminResponse = {
        token: 'super-admin-token',
        data: {
          id: 'super-admin-1',
          email: 'superadmin@example.com',
          firstName: 'Super',
          lastName: 'Admin',
          role: {
            id: 'super-admin-role',
            name: 'SuperAdmin',
            permissions: ['super_admin.full_access'],
          },
        },
      };

      authService.adminLogin.mockResolvedValue(superAdminResponse);

      const result = await controller.adminLogin(loginDto);

      expect((result as any).data.role.permissions).toContain(
        'super_admin.full_access',
      );
    });
  });

  describe('verifyAdmin', () => {
    it('should successfully verify admin with valid OTP', async () => {
      const activateDto = {
        otp: '123456',
        otpType: OtpType.ADMIN_LOGIN,
      };

      const verifyResponse = {
        token: 'verified-admin-token',
        user: {
          id: 'admin-1',
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          isEmailVerified: true,
        },
      };

      authService.verifyAdmin.mockResolvedValue(verifyResponse);

      const result = await controller.verifyAdmin(activateDto, mockUser as any);

      expect(result).toEqual(verifyResponse);
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(authService.verifyAdmin).toHaveBeenCalledWith(
        mockUser,
        activateDto,
      );
    });

    it('should verify admin and return sanitized user data', async () => {
      const activateDto = {
        otp: '654321',
        otpType: OtpType.ADMIN_LOGIN,
      };

      const verifyResponse = {
        token: 'new-admin-token',
        user: {
          id: 'admin-2',
          email: 'admin2@example.com',
          firstName: 'Another',
          lastName: 'Admin',
          isEmailVerified: true,
          status: AccountStatus.ACTIVE,
        },
      };

      authService.verifyAdmin.mockResolvedValue(verifyResponse);

      const result = await controller.verifyAdmin(activateDto, mockUser as any);

      expect(result.user).not.toHaveProperty('password');
      expect(result.user).toHaveProperty('email');
    });
  });

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token and set new cookie', async () => {
      const refreshResponse = {
        user: mockUser,
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      authService.refreshAccessToken.mockResolvedValue(refreshResponse);

      const result = await controller.refreshAccessToken(
        mockRequest,
        mockResponse,
      );

      expect(result).toEqual(refreshResponse);
      expect(authService.refreshAccessToken).toHaveBeenCalledWith(
        'existing-refresh-token',
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        refreshResponse.refreshToken,
        expect.objectContaining({
          maxAge: 7 * 24 * 60 * 60 * 1000,
          httpOnly: true,
          sameSite: 'lax',
        }),
      );
    });

    it('should throw BadRequestException when refresh token is missing', async () => {
      const requestWithoutCookie = {
        cookies: {},
      } as any;

      await expect(
        controller.refreshAccessToken(requestWithoutCookie, mockResponse),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.refreshAccessToken(requestWithoutCookie, mockResponse),
      ).rejects.toThrow('Refresh token missing');
    });

    it('should throw BadRequestException when cookies object is undefined', async () => {
      const requestWithNoCookies = {} as any;

      await expect(
        controller.refreshAccessToken(requestWithNoCookies, mockResponse),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle successful token refresh with new user data', async () => {
      const newUserResponse = {
        user: {
          ...mockUser,
          firstName: 'Updated',
          lastName: 'Name',
        },
        token: 'updated-token',
        refreshToken: 'updated-refresh-token',
      };

      authService.refreshAccessToken.mockResolvedValue(newUserResponse);

      const result = await controller.refreshAccessToken(
        mockRequest,
        mockResponse,
      );

      expect(result.user.firstName).toBe('Updated');
      expect(result.user.lastName).toBe('Name');
    });

    it('should set secure cookie based on environment', async () => {
      const refreshResponse = {
        user: mockUser,
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      authService.refreshAccessToken.mockResolvedValue(refreshResponse);

      await controller.refreshAccessToken(mockRequest, mockResponse);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
        }),
      );
    });
  });
});
