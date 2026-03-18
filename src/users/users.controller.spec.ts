import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guard/permission.guard';
import { AccountStatus, KycLevel, OtpType, UserType } from '@prisma/client';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+1234567890',
    userType: UserType.USER,
    status: AccountStatus.ACTIVE,
    isEmailVerified: true,
    verificationLevel: KycLevel.TIER_1,
    country: 'US',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockUsersService = {
      getAll: jest.fn(),
      viewOne: jest.fn(),
      createUser: jest.fn(),
      createUserTag: jest.fn(),
      setTransactionPin: jest.fn(),
      activateAccount: jest.fn(),
      resendOTP: jest.fn(),
      sendPasswordOtp: jest.fn(),
      passwordOtpVerify: jest.fn(),
      resetPassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(AuthGuard())
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllUsers', () => {
    it('should return paginated list of users', async () => {
      const mockResponse = {
        pagination: {
          page: 1,
          pageSize: 10,
          hasNext: false,
          hasPrevious: false,
          count: 1,
        },
        usersWithoutPassword: [mockUser],
      };

      usersService.getAll.mockResolvedValue(mockResponse);

      const result = await controller.getAllUsers(1, 10);

      expect(result).toEqual(mockResponse);
      expect(usersService.getAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should filter users by status', async () => {
      const mockResponse = {
        pagination: {
          page: 1,
          pageSize: 10,
          hasNext: false,
          hasPrevious: false,
          count: 1,
        },
        usersWithoutPassword: [mockUser],
      };

      usersService.getAll.mockResolvedValue(mockResponse);

      await controller.getAllUsers(
        1,
        10,
        AccountStatus.ACTIVE,
        undefined,
        undefined,
        undefined,
      );

      expect(usersService.getAll).toHaveBeenCalledWith(
        1,
        10,
        AccountStatus.ACTIVE,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should search users by search term', async () => {
      const mockResponse = {
        pagination: {
          page: 1,
          pageSize: 10,
          hasNext: false,
          hasPrevious: false,
          count: 1,
        },
        usersWithoutPassword: [mockUser],
      };

      usersService.getAll.mockResolvedValue(mockResponse);

      await controller.getAllUsers(
        1,
        10,
        undefined,
        'john',
        undefined,
        undefined,
      );

      expect(usersService.getAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        'john',
        undefined,
        undefined,
      );
    });

    it('should filter users by country', async () => {
      const mockResponse = {
        pagination: {
          page: 1,
          pageSize: 10,
          hasNext: false,
          hasPrevious: false,
          count: 1,
        },
        usersWithoutPassword: [mockUser],
      };

      usersService.getAll.mockResolvedValue(mockResponse);

      await controller.getAllUsers(
        1,
        10,
        undefined,
        undefined,
        'US',
        undefined,
      );

      expect(usersService.getAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
        'US',
        undefined,
      );
    });

    it('should filter users by verification level', async () => {
      const mockResponse = {
        pagination: {
          page: 1,
          pageSize: 10,
          hasNext: false,
          hasPrevious: false,
          count: 1,
        },
        usersWithoutPassword: [mockUser],
      };

      usersService.getAll.mockResolvedValue(mockResponse);

      await controller.getAllUsers(
        1,
        10,
        undefined,
        undefined,
        undefined,
        KycLevel.TIER_1,
      );

      expect(usersService.getAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
        undefined,
        KycLevel.TIER_1,
      );
    });
  });

  describe('viewUser', () => {
    it('should return a single user by id', async () => {
      usersService.viewOne.mockResolvedValue(mockUser);

      const result = await controller.viewUser('user-1');

      expect(result).toEqual(mockUser);
      expect(usersService.viewOne).toHaveBeenCalledWith('user-1');
    });
  });

  describe('setTransactionPin', () => {
    it('should set transaction pin for user', async () => {
      const pinDto = { transactionPin: 1234 };
      const response = { message: 'Transaction pin set successfully' };

      usersService.setTransactionPin.mockResolvedValue(response);

      const result = await controller.setTransactionPin(
        pinDto,
        mockUser as any,
      );

      expect(result).toEqual(response);
      expect(usersService.setTransactionPin).toHaveBeenCalledWith(
        mockUser,
        pinDto,
      );
    });
  });

  describe('activateAccount', () => {
    it('should activate user account with valid OTP', async () => {
      const activateDto = {
        otp: '123456',
        otpType: OtpType.SIGN_UP,
      };

      const response = {
        token: 'mock-jwt-token',
        data: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          phoneNumber: mockUser.phoneNumber,
          isEmailVerified: true,
        },
      };

      usersService.activateAccount.mockResolvedValue(response);

      const result = await controller.activateAccount(
        activateDto,
        mockUser as any,
      );

      expect(result).toEqual(response);
      expect(usersService.activateAccount).toHaveBeenCalledWith(
        mockUser,
        activateDto,
      );
    });
  });

  describe('signup', () => {
    it('should create a new user', async () => {
      const signUpDto = {
        email: 'new@example.com',
        phoneNumber: '+1234567890',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Doe',
        userType: UserType.USER,
      };

      const response = {
        token: 'mock-jwt-token',
        data: {
          id: 'new-user-id',
          email: signUpDto.email,
          firstName: signUpDto.firstName,
          lastName: signUpDto.lastName,
          phoneNumber: signUpDto.phoneNumber,
          isEmailVerified: false,
        },
      };

      usersService.createUser.mockResolvedValue(response);

      const result = await controller.signup(signUpDto);

      expect(result).toEqual(response);
      expect(usersService.createUser).toHaveBeenCalledWith(signUpDto);
    });
  });

  describe('createUserTag', () => {
    it('should create a user tag', async () => {
      const userTagDto = { userTag: 'MyTag' };
      const response = {
        message: 'User tag created successfully',
        data: '@mytag',
      };

      usersService.createUserTag.mockResolvedValue(response);

      const result = await controller.createUserTag(
        userTagDto,
        mockUser as any,
      );

      expect(result).toEqual(response);
      expect(usersService.createUserTag).toHaveBeenCalledWith(
        mockUser.id,
        userTagDto,
      );
    });
  });

  describe('resendOTP', () => {
    it('should resend OTP to user', async () => {
      const response = {
        message: 'OTP Sent Successfully',
        data: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          phoneNumber: mockUser.phoneNumber,
          isEmailVerified: mockUser.isEmailVerified,
        },
      };

      usersService.resendOTP.mockResolvedValue(response);

      const result = await controller.resendOTP(mockUser as any);

      expect(result).toEqual(response);
      expect(usersService.resendOTP).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset OTP', async () => {
      const sendOtpDto = { email: 'test@example.com' };
      const response = {
        message: 'OTP sent to your email address',
        data: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
        },
      };

      usersService.sendPasswordOtp.mockResolvedValue(response);

      const result = await controller.forgotPassword(sendOtpDto);

      expect(result).toEqual(response);
      expect(usersService.sendPasswordOtp).toHaveBeenCalledWith(sendOtpDto);
    });
  });

  describe('verifyPassword', () => {
    it('should verify password reset OTP', async () => {
      const verifyDto = {
        otp: '123456',
        otpType: OtpType.FORGOT_PASSWORD,
      };

      const response = { message: 'OTP verified successfully' };

      usersService.passwordOtpVerify.mockResolvedValue(response);

      const result = await controller.verifyPassword(verifyDto);

      expect(result).toEqual(response);
      expect(usersService.passwordOtpVerify).toHaveBeenCalledWith(verifyDto);
    });
  });

  describe('restPassword', () => {
    it('should reset user password', async () => {
      const resetDto = {
        email: 'test@example.com',
        password: 'newPassword123',
      };

      const response = { message: 'Password reset successfully' };

      usersService.resetPassword.mockResolvedValue(response);

      const result = await controller.restPassword(resetDto, '123456');

      expect(result).toEqual(response);
      expect(usersService.resetPassword).toHaveBeenCalledWith(
        resetDto,
        '123456',
      );
    });
  });
});
