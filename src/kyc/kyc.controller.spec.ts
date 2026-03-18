import { Test, TestingModule } from '@nestjs/testing';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  DocumentVerificationStatus,
  IdentityType,
  KycLevel,
  BillType,
  User,
} from '@prisma/client';
import { BvnDto } from './dto/bvn.dto';
import { TaxAddressDto } from './dto/taxAddress.dto';
import { IdentityVerificationDto } from './dto/identityVerification.dto';
import { UtilityVerificationDto } from './dto/utility.dto';

describe('KycController', () => {
  let controller: KycController;
  let kycService: jest.Mocked<KycService>;

  const mockUser: Partial<User> = {
    id: 'user123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    kycLevel: KycLevel.TIER_1,
  };

  beforeEach(async () => {
    const mockKycService = {
      checkUserKycStatus: jest.fn(),
      verifyBvn: jest.fn(),
      updateTaxAddress: jest.fn(),
      verifyIdentityDocument: jest.fn(),
      verifyUtility: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KycController],
      providers: [
        {
          provide: KycService,
          useValue: mockKycService,
        },
      ],
    })
      .overrideGuard(AuthGuard())
      .useValue({
        canActivate: (_context: ExecutionContext) => {
          return true;
        },
      })
      .compile();

    controller = module.get<KycController>(KycController);
    kycService = module.get(KycService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkKycStatus', () => {
    it('should return KYC status for TIER_0 user', async () => {
      const expectedResponse = {
        status: 200,
        message: 'user KYC tier is tier 1 of 2',
        data: KycLevel.TIER_1,
      };
      kycService.checkUserKycStatus.mockResolvedValue(expectedResponse);

      const result = await controller.checkKycStatus(mockUser as User);

      expect(result).toEqual(expectedResponse);
      expect(kycService.checkUserKycStatus).toHaveBeenCalledWith('user123');
    });

    it('should return KYC status for TIER_1 user', async () => {
      const expectedResponse = {
        status: 200,
        message: 'user KYC tier is tier 1 of 2',
        data: KycLevel.TIER_1,
      };
      kycService.checkUserKycStatus.mockResolvedValue(expectedResponse);

      const result = await controller.checkKycStatus(mockUser as User);

      expect(result).toEqual(expectedResponse);
      expect(kycService.checkUserKycStatus).toHaveBeenCalledWith('user123');
    });

    it('should return KYC status for TIER_2 user', async () => {
      const expectedResponse = {
        message: 'user KYC tier is tier 2 of 2',
        data: KycLevel.TIER_2,
      };
      kycService.checkUserKycStatus.mockResolvedValue(expectedResponse);

      const result = await controller.checkKycStatus(mockUser as User);

      expect(result).toEqual(expectedResponse);
      expect(kycService.checkUserKycStatus).toHaveBeenCalledWith('user123');
    });

    it('should pass user ID from authenticated user to service', async () => {
      const customUser = { ...mockUser, id: 'customUserId' } as User;
      kycService.checkUserKycStatus.mockResolvedValue({} as any);

      await controller.checkKycStatus(customUser);

      expect(kycService.checkUserKycStatus).toHaveBeenCalledWith(
        'customUserId',
      );
    });
  });

  describe('verifyBvn', () => {
    const bvnDto: BvnDto = {
      number: '12345678901',
    };

    it('should successfully verify BVN', async () => {
      const expectedResponse = {
        message: 'BVN verified successfully',
        kycLevel: KycLevel.TIER_1,
      };
      kycService.verifyBvn.mockResolvedValue(expectedResponse);

      const result = await controller.verifyBvn(bvnDto, mockUser as User);

      expect(result).toEqual(expectedResponse);
      expect(kycService.verifyBvn).toHaveBeenCalledWith('user123', bvnDto);
    });

    it('should handle BVN already verified scenario', async () => {
      const expectedResponse = {
        message: 'BVN already verified',
        kycLevel: KycLevel.TIER_1,
        bvnVerified: DocumentVerificationStatus.PASSED,
      };
      kycService.verifyBvn.mockResolvedValue(expectedResponse);

      const result = await controller.verifyBvn(bvnDto, mockUser as User);

      expect(result).toEqual(expectedResponse);
      expect(kycService.verifyBvn).toHaveBeenCalledWith('user123', bvnDto);
    });

    it('should pass correct user ID and payload to service', async () => {
      kycService.verifyBvn.mockResolvedValue({} as any);
      const customUser = { ...mockUser, id: 'differentUserId' } as User;
      const customBvn = { number: '98765432109' };

      await controller.verifyBvn(customBvn, customUser);

      expect(kycService.verifyBvn).toHaveBeenCalledWith(
        'differentUserId',
        customBvn,
      );
    });

    it('should propagate service errors', async () => {
      const error = new Error('BVN verification failed');
      kycService.verifyBvn.mockRejectedValue(error);

      await expect(
        controller.verifyBvn(bvnDto, mockUser as User),
      ).rejects.toThrow(error);
    });
  });

  describe('updateTaxAddress', () => {
    const taxAddressDto: TaxAddressDto = {
      country: 'USA',
      state: 'California',
      city: 'Los Angeles',
      street: '123 Main St',
      houseNo: '1A',
      zipCode: '90001',
      nationality: 'American',
      taxCountry: 'US',
      taxNumber: '123456789',
    };

    it('should successfully update tax address', async () => {
      const expectedResponse = {
        message: 'Tax address updated successfully',
        data: { isTaxAddressCompleted: true },
      };
      kycService.updateTaxAddress.mockResolvedValue(expectedResponse);

      const result = await controller.updateTaxAddress(
        taxAddressDto,
        mockUser as User,
      );

      expect(result).toEqual(expectedResponse);
      expect(kycService.updateTaxAddress).toHaveBeenCalledWith(
        mockUser,
        taxAddressDto,
      );
    });

    it('should handle incomplete tax address', async () => {
      const incompleteTaxDto: TaxAddressDto = {
        country: 'USA',
        state: '',
      };
      const expectedResponse = {
        message: 'Tax address updated successfully',
        data: { isTaxAddressCompleted: false },
      };
      kycService.updateTaxAddress.mockResolvedValue(expectedResponse);

      const result = await controller.updateTaxAddress(
        incompleteTaxDto,
        mockUser as User,
      );

      expect(result).toEqual(expectedResponse);
      expect(kycService.updateTaxAddress).toHaveBeenCalledWith(
        mockUser,
        incompleteTaxDto,
      );
    });

    it('should pass user object and payload to service', async () => {
      kycService.updateTaxAddress.mockResolvedValue({} as any);
      const customUser = { ...mockUser, id: 'customId' } as User;

      await controller.updateTaxAddress(taxAddressDto, customUser);

      expect(kycService.updateTaxAddress).toHaveBeenCalledWith(
        customUser,
        taxAddressDto,
      );
    });

    it('should propagate service errors', async () => {
      const error = new Error('Tax address update failed');
      kycService.updateTaxAddress.mockRejectedValue(error);

      await expect(
        controller.updateTaxAddress(taxAddressDto, mockUser as User),
      ).rejects.toThrow(error);
    });
  });

  describe('verifyIdentity', () => {
    const identityDto: IdentityVerificationDto = {
      identityType: IdentityType.NIN,
      identityTypeNo: '12345678901',
      issuedCountry: 'Nigeria',
      issuedDate: new Date('2020-01-01'),
      expiryDate: new Date('2030-01-01'),
    };

    const mockFile = {
      fieldname: 'file',
      originalname: 'id.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('test'),
      size: 1024,
    };

    it('should successfully verify identity document', async () => {
      const expectedResponse = {
        message: 'NIN verified successfully',
        kycLevel: KycLevel.TIER_2,
        idVerified: DocumentVerificationStatus.PASSED,
      };
      kycService.verifyIdentityDocument.mockResolvedValue(expectedResponse);

      const result = await controller.verifyIdentity(
        mockFile,
        identityDto,
        mockUser as User,
      );

      expect(result).toEqual(expectedResponse);
      expect(kycService.verifyIdentityDocument).toHaveBeenCalledWith(
        'user123',
        identityDto,
        mockFile,
      );
    });

    it('should handle passport verification', async () => {
      const passportDto: IdentityVerificationDto = {
        ...identityDto,
        identityType: IdentityType.PASSPORT,
        identityTypeNo: 'A12345678',
      };
      const expectedResponse = {
        message: 'PASSPORT verified successfully',
        kycLevel: KycLevel.TIER_2,
        idVerified: DocumentVerificationStatus.PASSED,
      };
      kycService.verifyIdentityDocument.mockResolvedValue(expectedResponse);

      const result = await controller.verifyIdentity(
        mockFile,
        passportDto,
        mockUser as User,
      );

      expect(result).toEqual(expectedResponse);
      expect(kycService.verifyIdentityDocument).toHaveBeenCalledWith(
        'user123',
        passportDto,
        mockFile,
      );
    });

    it('should handle driver license verification', async () => {
      const licenseDto: IdentityVerificationDto = {
        ...identityDto,
        identityType: IdentityType.DRIVER_LICENSE,
        identityTypeNo: 'ABC123456789',
      };
      const expectedResponse = {
        message: 'DRIVER_LICENSE verified successfully',
        kycLevel: KycLevel.TIER_2,
        idVerified: DocumentVerificationStatus.PASSED,
      };
      kycService.verifyIdentityDocument.mockResolvedValue(expectedResponse);

      const result = await controller.verifyIdentity(
        mockFile,
        licenseDto,
        mockUser as User,
      );

      expect(result).toEqual(expectedResponse);
      expect(kycService.verifyIdentityDocument).toHaveBeenCalledWith(
        'user123',
        licenseDto,
        mockFile,
      );
    });

    it('should handle already verified identity', async () => {
      const expectedResponse = {
        message: 'ID already verified',
        kycLevel: KycLevel.TIER_2,
        idVerified: true,
      };
      kycService.verifyIdentityDocument.mockResolvedValue(expectedResponse);

      const result = await controller.verifyIdentity(
        mockFile,
        identityDto,
        mockUser as User,
      );

      expect(result).toEqual(expectedResponse);
    });

    it('should pass correct user ID, payload, and file to service', async () => {
      kycService.verifyIdentityDocument.mockResolvedValue({} as any);
      const customUser = { ...mockUser, id: 'customUserId' } as User;

      await controller.verifyIdentity(mockFile, identityDto, customUser);

      expect(kycService.verifyIdentityDocument).toHaveBeenCalledWith(
        'customUserId',
        identityDto,
        mockFile,
      );
    });

    it('should propagate service errors', async () => {
      const error = new Error('Identity verification failed');
      kycService.verifyIdentityDocument.mockRejectedValue(error);

      await expect(
        controller.verifyIdentity(mockFile, identityDto, mockUser as User),
      ).rejects.toThrow(error);
    });
  });

  describe('verifyUtility', () => {
    const utilityDto: UtilityVerificationDto = {
      utilityType: BillType.ELECTRICITY,
    };

    const mockFile = {
      fieldname: 'file',
      originalname: 'bill.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('test'),
      size: 1024,
    };

    it('should successfully verify utility bill', async () => {
      const expectedResponse = {
        message: 'Utility bill verified successfully',
        kycLevel: KycLevel.TIER_2,
        isUtilityBillVerified: true,
      };
      kycService.verifyUtility.mockResolvedValue(expectedResponse);

      const result = await controller.verifyUtility(
        mockFile,
        utilityDto,
        mockUser as User,
      );

      expect(result).toEqual(expectedResponse);
      expect(kycService.verifyUtility).toHaveBeenCalledWith(
        'user123',
        mockFile,
        utilityDto,
      );
    });

    it('should handle water bill verification', async () => {
      const waterBillDto: UtilityVerificationDto = {
        utilityType: BillType.WATER,
      };
      const expectedResponse = {
        message: 'Utility bill verified successfully',
        kycLevel: KycLevel.TIER_2,
        isUtilityBillVerified: true,
      };
      kycService.verifyUtility.mockResolvedValue(expectedResponse);

      const result = await controller.verifyUtility(
        mockFile,
        waterBillDto,
        mockUser as User,
      );

      expect(result).toEqual(expectedResponse);
      expect(kycService.verifyUtility).toHaveBeenCalledWith(
        'user123',
        mockFile,
        waterBillDto,
      );
    });

    it('should handle gas bill verification', async () => {
      const gasBillDto: UtilityVerificationDto = {
        utilityType: BillType.GAS,
      };
      const expectedResponse = {
        message: 'Utility bill verified successfully',
        kycLevel: KycLevel.TIER_2,
        isUtilityBillVerified: true,
      };
      kycService.verifyUtility.mockResolvedValue(expectedResponse);

      const result = await controller.verifyUtility(
        mockFile,
        gasBillDto,
        mockUser as User,
      );

      expect(result).toEqual(expectedResponse);
      expect(kycService.verifyUtility).toHaveBeenCalledWith(
        'user123',
        mockFile,
        gasBillDto,
      );
    });

    it('should pass correct user ID, file, and payload to service', async () => {
      kycService.verifyUtility.mockResolvedValue({} as any);
      const customUser = { ...mockUser, id: 'customUserId' } as User;

      await controller.verifyUtility(mockFile, utilityDto, customUser);

      expect(kycService.verifyUtility).toHaveBeenCalledWith(
        'customUserId',
        mockFile,
        utilityDto,
      );
    });

    it('should propagate service errors', async () => {
      const error = new Error('Utility verification failed');
      kycService.verifyUtility.mockRejectedValue(error);

      await expect(
        controller.verifyUtility(mockFile, utilityDto, mockUser as User),
      ).rejects.toThrow(error);
    });
  });
});
