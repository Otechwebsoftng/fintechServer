import { Test, TestingModule } from '@nestjs/testing';
import { VirtualAccountController } from './virtual-account.controller';
import { VirtualAccountService } from './virtual-account.service';
import { AuthGuard } from '@nestjs/passport';
import { Currency, WalletType, WalletStatus, User } from '@prisma/client';

describe('VirtualAccountController', () => {
  let controller: VirtualAccountController;
  let virtualAccountService: any;

  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    phoneNumber: '1234567890',
    firstName: 'John',
    lastName: 'Doe',
    password: 'hashedpassword',
    accountStatus: 'ACTIVE' as any,
    bvn: '12345678901',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'MALE' as any,
    userType: 'INDIVIDUAL' as any,
    address: '123 Main St',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    postalCode: '100001',
    kycLevel: 'LEVEL_1' as any,
    isTwoFactorEnabled: false,
    twoFactorSecret: null,
    transactionPin: null,
    verificationStatus: 'VERIFIED' as any,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    isTaxCompleted: false,
    userTag: null,
    adminVerifiedBy: null,
    tier: 'TIER_1' as any,
  } as any;

  const mockWallet = {
    id: 1,
    userId: '1',
    walletName: 'John Doe Wallet',
    walletType: WalletType.INDIVIDUAL,
    currency: Currency.NGN,
    balance: '0',
    status: WalletStatus.APPROVED,
    accountNumber: '1234567890',
    bankName: 'Test Bank',
    accountName: 'John Doe',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockVirtualAccountService = {
      createVirtualAccount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VirtualAccountController],
      providers: [
        {
          provide: VirtualAccountService,
          useValue: mockVirtualAccountService,
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<VirtualAccountController>(VirtualAccountController);
    virtualAccountService = module.get(VirtualAccountService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createVirtualAccount', () => {
    it('should create a virtual account successfully', async () => {
      virtualAccountService.createVirtualAccount.mockResolvedValue(mockWallet);

      const result = await controller.createVirtualAccount(mockUser);

      expect(result).toEqual(mockWallet);
      expect(virtualAccountService.createVirtualAccount).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(virtualAccountService.createVirtualAccount).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should extract user id from user object correctly', async () => {
      virtualAccountService.createVirtualAccount.mockResolvedValue(mockWallet);

      await controller.createVirtualAccount(mockUser);

      expect(virtualAccountService.createVirtualAccount).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should handle different user types correctly', async () => {
      const businessUser = {
        ...mockUser,
        id: '2',
        userType: 'COOPERATE' as any,
        email: 'business@example.com',
      };

      const businessWallet = {
        ...mockWallet,
        id: 2,
        userId: '2',
        walletType: WalletType.COOPERATE,
      };

      virtualAccountService.createVirtualAccount.mockResolvedValue(
        businessWallet,
      );

      const result = await controller.createVirtualAccount(businessUser);

      expect(result).toEqual(businessWallet);
      expect(virtualAccountService.createVirtualAccount).toHaveBeenCalledWith(
        businessUser.id,
      );
    });

    it('should propagate service errors', async () => {
      const error = new Error('Service error');
      virtualAccountService.createVirtualAccount.mockRejectedValue(error);

      await expect(controller.createVirtualAccount(mockUser)).rejects.toThrow(
        'Service error',
      );
      expect(virtualAccountService.createVirtualAccount).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should handle NotFoundException from service', async () => {
      const notFoundError = new Error('User not found');
      notFoundError.name = 'NotFoundException';
      virtualAccountService.createVirtualAccount.mockRejectedValue(
        notFoundError,
      );

      await expect(controller.createVirtualAccount(mockUser)).rejects.toThrow(
        'User not found',
      );
    });

    it('should handle BadRequestException from service', async () => {
      const badRequestError = new Error('Invalid user data');
      badRequestError.name = 'BadRequestException';
      virtualAccountService.createVirtualAccount.mockRejectedValue(
        badRequestError,
      );

      await expect(controller.createVirtualAccount(mockUser)).rejects.toThrow(
        'Invalid user data',
      );
    });

    it('should work with user having minimum required fields', async () => {
      const minimalUser = {
        ...mockUser,
        id: '3',
      };

      virtualAccountService.createVirtualAccount.mockResolvedValue(mockWallet);

      await controller.createVirtualAccount(minimalUser);

      expect(virtualAccountService.createVirtualAccount).toHaveBeenCalledWith(
        '3',
      );
    });

    it('should handle string user ids correctly', async () => {
      const userWithLargeId = {
        ...mockUser,
        id: '999999',
      };

      virtualAccountService.createVirtualAccount.mockResolvedValue(mockWallet);

      await controller.createVirtualAccount(userWithLargeId);

      expect(virtualAccountService.createVirtualAccount).toHaveBeenCalledWith(
        '999999',
      );
    });
  });
});
