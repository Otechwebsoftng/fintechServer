import { Test, TestingModule } from '@nestjs/testing';
import { VirtualAccountService } from './virtual-account.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { CustomLogger } from '../custom.logger';
import { FincraVerificationService } from '../vendors/fincra.verification-service';
import { Currency, WalletStatus, WalletType } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('VirtualAccountService', () => {
  let service: VirtualAccountService;
  let prismaService: any;
  let usersService: any;
  let walletService: any;
  let fincraVerificationService: any;
  let logger: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    bvn: '12345678901',
    phoneNumber: '+1234567890',
    userType: 'INDIVIDUAL',
  };

  const mockFincraResponse = {
    data: {
      _id: 'virtual-account-id-1',
      merchantReference: 'merchant-ref-123',
      accountInformation: {
        bankName: 'Test Bank',
        accountNumber: '1234567890',
        channelReference: 'channel-ref-123',
      },
    },
  };

  const mockWallet = {
    id: 'wallet-1',
    userId: 'user-1',
    currency: Currency.NGN,
    accountType: WalletType.INDIVIDUAL,
    virtualAccountId: 'virtual-account-id-1',
    status: WalletStatus.APPROVED,
    merchantReference: 'merchant-ref-123',
    bankName: 'Test Bank',
    accountNumber: '1234567890',
    channelReference: 'channel-ref-123',
    balance: 0,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      wallet: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const mockUsersService = {
      getOne: jest.fn(),
    };

    const mockWalletService = {
      getOne: jest.fn(),
    };

    const mockFincraService = {
      requestAccount: jest.fn(),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VirtualAccountService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: WalletService, useValue: mockWalletService },
        { provide: CustomLogger, useValue: mockLogger },
        {
          provide: FincraVerificationService,
          useValue: mockFincraService,
        },
      ],
    }).compile();

    service = module.get<VirtualAccountService>(VirtualAccountService);
    prismaService = module.get(PrismaService);
    usersService = module.get(UsersService);
    walletService = module.get(WalletService);
    fincraVerificationService = module.get(FincraVerificationService);
    logger = module.get(CustomLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createVirtualAccount', () => {
    it('should create a virtual account successfully', async () => {
      usersService.getOne.mockResolvedValue(mockUser);
      walletService.getOne.mockResolvedValue(null);
      fincraVerificationService.requestAccount.mockResolvedValue(
        mockFincraResponse,
      );
      prismaService.wallet.create.mockResolvedValue(mockWallet);

      const result = await service.createVirtualAccount('user-1');

      expect(result).toHaveProperty(
        'message',
        'Virtual account created successfully',
      );
      expect(result).toHaveProperty('data');
      expect(result.data).not.toHaveProperty('isDeleted');
      expect(result.data).not.toHaveProperty('createdAt');
      expect(result.data).not.toHaveProperty('updatedAt');
      expect(result.data).toHaveProperty('accountNumber');
      expect(result.data).toHaveProperty('bankName');
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Virtual account created successfully'),
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      usersService.getOne.mockResolvedValue(null);

      await expect(
        service.createVirtualAccount('invalid-user'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.createVirtualAccount('invalid-user'),
      ).rejects.toThrow('User not found');
      expect(fincraVerificationService.requestAccount).not.toHaveBeenCalled();
      expect(prismaService.wallet.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when KYC information is incomplete - missing firstName', async () => {
      const incompleteUser = { ...mockUser, firstName: null };
      usersService.getOne.mockResolvedValue(incompleteUser);

      await expect(service.createVirtualAccount('user-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createVirtualAccount('user-1')).rejects.toThrow(
        'Incomplete KYC information',
      );
      expect(fincraVerificationService.requestAccount).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when KYC information is incomplete - missing email', async () => {
      const incompleteUser = { ...mockUser, email: null };
      usersService.getOne.mockResolvedValue(incompleteUser);

      await expect(service.createVirtualAccount('user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(fincraVerificationService.requestAccount).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when KYC information is incomplete - missing bvn', async () => {
      const incompleteUser = { ...mockUser, bvn: null };
      usersService.getOne.mockResolvedValue(incompleteUser);

      await expect(service.createVirtualAccount('user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(fincraVerificationService.requestAccount).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when virtual account already exists', async () => {
      usersService.getOne.mockResolvedValue(mockUser);
      walletService.getOne.mockResolvedValue(mockWallet);

      await expect(service.createVirtualAccount('user-1')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.createVirtualAccount('user-1')).rejects.toThrow(
        'Virtual account already exists for this user',
      );
      expect(fincraVerificationService.requestAccount).not.toHaveBeenCalled();
    });

    it('should use INDIVIDUAL account type for individual users', async () => {
      usersService.getOne.mockResolvedValue(mockUser);
      walletService.getOne.mockResolvedValue(null);
      fincraVerificationService.requestAccount.mockResolvedValue(
        mockFincraResponse,
      );
      prismaService.wallet.create.mockResolvedValue(mockWallet);

      await service.createVirtualAccount('user-1');

      expect(fincraVerificationService.requestAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          accountType: 'individual',
        }),
      );
      expect(prismaService.wallet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountType: WalletType.INDIVIDUAL,
          }),
        }),
      );
    });

    it('should call fincra service with correct payload', async () => {
      usersService.getOne.mockResolvedValue(mockUser);
      walletService.getOne.mockResolvedValue(null);
      fincraVerificationService.requestAccount.mockResolvedValue(
        mockFincraResponse,
      );
      prismaService.wallet.create.mockResolvedValue(mockWallet);

      await service.createVirtualAccount('user-1');

      expect(fincraVerificationService.requestAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          accountType: 'individual',
          currency: Currency.NGN,
          KYCInformation: expect.objectContaining({
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
            email: mockUser.email,
            bvn: mockUser.bvn,
          }),
        }),
      );
    });

    it('should create wallet with correct data from fincra response', async () => {
      usersService.getOne.mockResolvedValue(mockUser);
      walletService.getOne.mockResolvedValue(null);
      fincraVerificationService.requestAccount.mockResolvedValue(
        mockFincraResponse,
      );
      prismaService.wallet.create.mockResolvedValue(mockWallet);

      await service.createVirtualAccount('user-1');

      expect(prismaService.wallet.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          currency: Currency.NGN,
          accountType: WalletType.INDIVIDUAL,
          virtualAccountId: mockFincraResponse.data._id,
          status: WalletStatus.APPROVED,
          merchantReference: mockFincraResponse.data.merchantReference,
          bankName: mockFincraResponse.data.accountInformation.bankName,
          accountNumber:
            mockFincraResponse.data.accountInformation.accountNumber,
          channelReference:
            mockFincraResponse.data.accountInformation.channelReference,
        },
      });
    });

    it('should throw BadRequestException for invalid Fincra response - missing _id', async () => {
      const invalidResponse = {
        data: {
          accountInformation: {
            bankName: 'Test Bank',
            accountNumber: '1234567890',
          },
        },
      };

      usersService.getOne.mockResolvedValue(mockUser);
      walletService.getOne.mockResolvedValue(null);
      fincraVerificationService.requestAccount.mockResolvedValue(
        invalidResponse,
      );

      await expect(service.createVirtualAccount('user-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createVirtualAccount('user-1')).rejects.toThrow(
        'Invalid response from payment provider',
      );
      expect(prismaService.wallet.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid Fincra response - missing accountNumber', async () => {
      const invalidResponse = {
        data: {
          _id: 'virtual-account-id-1',
          accountInformation: {
            bankName: 'Test Bank',
          },
        },
      };

      usersService.getOne.mockResolvedValue(mockUser);
      walletService.getOne.mockResolvedValue(null);
      fincraVerificationService.requestAccount.mockResolvedValue(
        invalidResponse,
      );

      await expect(service.createVirtualAccount('user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaService.wallet.create).not.toHaveBeenCalled();
    });

    it('should handle fincra service errors and log them', async () => {
      usersService.getOne.mockResolvedValue(mockUser);
      walletService.getOne.mockResolvedValue(null);
      fincraVerificationService.requestAccount.mockRejectedValue(
        new Error('Fincra API error'),
      );

      await expect(service.createVirtualAccount('user-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createVirtualAccount('user-1')).rejects.toThrow(
        'Failed to create virtual account',
      );
      expect(prismaService.wallet.create).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create virtual account'),
        expect.any(String),
      );
    });

    it('should handle database errors when creating wallet', async () => {
      usersService.getOne.mockResolvedValue(mockUser);
      walletService.getOne.mockResolvedValue(null);
      fincraVerificationService.requestAccount.mockResolvedValue(
        mockFincraResponse,
      );
      prismaService.wallet.create.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.createVirtualAccount('user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('should use NGN currency by default', async () => {
      usersService.getOne.mockResolvedValue(mockUser);
      walletService.getOne.mockResolvedValue(null);
      fincraVerificationService.requestAccount.mockResolvedValue(
        mockFincraResponse,
      );
      prismaService.wallet.create.mockResolvedValue(mockWallet);

      await service.createVirtualAccount('user-1');

      expect(fincraVerificationService.requestAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: Currency.NGN,
        }),
      );
    });

    it('should sanitize wallet data before returning', async () => {
      usersService.getOne.mockResolvedValue(mockUser);
      walletService.getOne.mockResolvedValue(null);
      fincraVerificationService.requestAccount.mockResolvedValue(
        mockFincraResponse,
      );
      prismaService.wallet.create.mockResolvedValue(mockWallet);

      const result = await service.createVirtualAccount('user-1');

      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('userId');
      expect(result.data).toHaveProperty('accountNumber');
      expect(result.data).not.toHaveProperty('isDeleted');
      expect(result.data).not.toHaveProperty('createdAt');
      expect(result.data).not.toHaveProperty('updatedAt');
    });

    it('should re-throw known exceptions without wrapping', async () => {
      usersService.getOne.mockResolvedValue(mockUser);
      walletService.getOne.mockResolvedValue(mockWallet);

      await expect(service.createVirtualAccount('user-1')).rejects.toThrow(
        ConflictException,
      );

      // Should not be wrapped in BadRequestException
      try {
        await service.createVirtualAccount('user-1');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        expect(error).not.toBeInstanceOf(BadRequestException);
      }
    });
  });
});
