import { Test, TestingModule } from '@nestjs/testing';
import { KycService } from './kyc.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { DojahVerificationService } from '../vendors/dojah.verification';
import { CustomLogger } from '../custom.logger';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DocumentVerificationStatus,
  IdentityType,
  KycLevel,
  Gender,
  BillType,
  EmploymentStatus,
  PrimaryPurposeUSDAccount,
  SourceOfFunds,
} from '@prisma/client';
import { BvnDto } from './dto/bvn.dto';
import { TaxAddressDto } from './dto/taxAddress.dto';
import { IdentityVerificationDto } from './dto/identityVerification.dto';
import { UtilityVerificationDto } from './dto/utility.dto';
import { Utility } from '../helpers/utilities.service';
import { FincraVerificationService } from 'src/vendors/fincra.verification-service';
import { GraphService } from 'src/vendors/graph.service';
import { WalletService } from 'src/wallet/wallet.service';

describe('KycService', () => {
  let service: KycService;
  let prismaService: any;
  let usersService: any;
  let fincraVerificationService: any;
  let dojahVerificationService: any;
  let graphService: any;
  let walletService: any;

  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    otherName: null,
    phoneNumber: '+2348012345678',
    dob: new Date('1990-01-01'),
    gender: Gender.MALE,
    bvn: '12345678901',
    bvnVerified: DocumentVerificationStatus.NOT_VERIFIED,
    kycLevel: KycLevel.TIER_1,
    identityType: IdentityType.PASSPORT,
    identityTypeNo: 'A12345678',
    identityVerificationStatus: DocumentVerificationStatus.NOT_VERIFIED,
    identityTypeUrl: 'https://cloudinary.com/identity.jpg',
    identityTypePublicId: 'identity123',
    issuedPlace: null,
    expiryDate: null,
    issuedDate: null,
    isUtilityBillVerified: false,
    taxAddress: {
      userId: 'user123',
      country: 'NG',
      state: 'Lagos',
      city: 'Lagos',
      street: 'Test Street',
      houseNo: '123',
      zipCode: '100001',
      nationality: 'NG',
      taxCountry: 'NG',
      taxNumber: null,
      isTaxAddressCompleted: true,
    },
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      taxAddress: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockUsersService = {
      getOne: jest.fn(),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockVerificationService = {
      verifyBvn: jest.fn(),
    };

    const mockDojahVerificationService = {
      verifyIdentity: jest.fn(),
      verifyUtilityBillImage: jest.fn(),
      verifyBvn: jest.fn(),
      verifyNin: jest.fn(),
      verifyDriversLicense: jest.fn(),
      internationalPassport: jest.fn(),
    };

    const mockGraphService = {
      createNGNPerson: jest.fn(),
      createUSDPerson: jest.fn(),
      createVirtualAccount: jest.fn(),
    };

    const mockWalletService = {
      createVirtualNGNAccount: jest.fn(),
      createVirtualUSDAccount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: CustomLogger, useValue: mockLogger },
        {
          provide: FincraVerificationService,
          useValue: mockVerificationService,
        },
        {
          provide: DojahVerificationService,
          useValue: mockDojahVerificationService,
        },
        {
          provide: GraphService,
          useValue: mockGraphService,
        },
        {
          provide: WalletService,
          useValue: mockWalletService,
        },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
    prismaService = module.get(PrismaService);
    usersService = module.get(UsersService);
    fincraVerificationService = module.get(FincraVerificationService);
    dojahVerificationService = module.get(DojahVerificationService);
    graphService = module.get(GraphService);
    walletService = module.get(WalletService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkUserKycStatus', () => {
    it('should return NOT FOUND when user does not exist', async () => {
      usersService.getOne.mockResolvedValue(null);

      const result = await service.checkUserKycStatus('user123');

      expect(result).toBeInstanceOf(NotFoundException);
      expect(usersService.getOne).toHaveBeenCalledWith({ id: 'user123' });
    });

    it('should return TIER_1 status for a TIER_1 user', async () => {
      const tier1User = { ...mockUser, kycLevel: KycLevel.TIER_1 };
      usersService.getOne.mockResolvedValue(tier1User as any);

      const result = await service.checkUserKycStatus('user123');

      expect(result).toEqual({
        status: 200,
        message: 'user KYC tier is tier 1 of 2',
        data: KycLevel.TIER_1,
      });
    });

    it('should return TIER_2 status for a TIER_2 user', async () => {
      const tier2User = { ...mockUser, kycLevel: KycLevel.TIER_2 };
      usersService.getOne.mockResolvedValue(tier2User as any);

      const result = await service.checkUserKycStatus('user123');

      expect(result).toEqual({
        message: 'user KYC tier is tier 2 of 2',
        data: KycLevel.TIER_2,
      });
    });
  });

  describe('verifyBvn', () => {
    const bvnDto: BvnDto = { number: '12345678901' };

    it('should throw BadRequestException for invalid BVN format', async () => {
      const invalidBvnDto: BvnDto = { number: '123' };

      await expect(service.verifyBvn('user123', invalidBvnDto)).rejects.toThrow(
        new BadRequestException('Verification failed, invalid BVN format'),
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      usersService.getOne.mockResolvedValue(null);

      await expect(service.verifyBvn('user123', bvnDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return early if BVN already verified', async () => {
      const verifiedUser = {
        ...mockUser,
        bvnVerified: DocumentVerificationStatus.PASSED,
        kycLevel: KycLevel.TIER_1,
      };
      usersService.getOne.mockResolvedValue(verifiedUser as any);

      const result = await service.verifyBvn('user123', bvnDto);

      expect(result).toEqual({
        message: 'BVN already verified',
        kycLevel: KycLevel.TIER_1,
        bvnVerified: DocumentVerificationStatus.PASSED,
      });
      expect(fincraVerificationService.verifyBvn).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if BVN already registered to another user', async () => {
      usersService.getOne.mockResolvedValue(mockUser as any);
      prismaService.user.findFirst.mockResolvedValue({
        id: 'otherUser',
      } as any);

      await expect(service.verifyBvn('user123', bvnDto)).rejects.toThrow(
        new BadRequestException('BVN already registered to another account'),
      );
    });

    it('should throw BadRequestException if BVN verification fails', async () => {
      usersService.getOne.mockResolvedValue(mockUser as any);
      prismaService.user.findFirst.mockResolvedValue(null);
      fincraVerificationService.verifyBvn.mockResolvedValue({
        data: { verificationStatus: 'failed', response: {} },
      } as any);

      await expect(service.verifyBvn('user123', bvnDto)).rejects.toThrow(
        new BadRequestException('BVN verification failed'),
      );
    });

    it('should successfully verify BVN and update user', async () => {
      usersService.getOne.mockResolvedValue(mockUser as any);
      prismaService.user.findFirst.mockResolvedValue(null);
      fincraVerificationService.verifyBvn.mockResolvedValue({
        data: {
          verificationStatus: 'verified',
          response: {
            firstName: 'John',
            lastName: 'Doe',
            middleName: 'Middle',
            dateOfBirth: '1990-01-01',
            phoneNo: '+2348012345678',
            gender: 'M',
          },
        },
      } as any);
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        bvnVerified: DocumentVerificationStatus.PASSED,
        kycLevel: KycLevel.TIER_1,
      } as any);

      const result = await service.verifyBvn('user123', bvnDto);

      expect(result).toEqual({
        message: 'BVN verified successfully',
        kycLevel: KycLevel.TIER_1,
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: expect.objectContaining({
          bvn: bvnDto.number,
          bvnVerified: DocumentVerificationStatus.PASSED,
          kycLevel: KycLevel.TIER_1,
          firstName: 'John',
          lastName: 'Doe',
          otherName: 'Middle',
          gender: Gender.MALE,
        }),
      });
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

    it('should create new tax address if none exists', async () => {
      const userId = 'user123';
      prismaService.taxAddress.upsert.mockResolvedValue({
        userId,
        ...taxAddressDto,
        isTaxAddressCompleted: true,
      } as any);

      const result = await service.updateTaxAddress(
        mockUser as any,
        taxAddressDto,
      );

      expect(result).toEqual({
        message: 'Tax address updated successfully',
        data: { isTaxAddressCompleted: true },
      });
      expect(prismaService.taxAddress.upsert).toHaveBeenCalledWith({
        where: { userId },
        update: taxAddressDto,
        create: {
          ...taxAddressDto,
          user: { connect: { id: userId } },
        },
      });
    });

    it('should mark tax address as incomplete if required fields are missing', async () => {
      const incompleteTaxDto: TaxAddressDto = {
        country: 'USA',
        state: '',
        city: '',
      };
      prismaService.taxAddress.upsert.mockResolvedValue({
        userId: 'user123',
        ...incompleteTaxDto,
        isTaxAddressCompleted: false,
      } as any);
      prismaService.taxAddress.update.mockResolvedValue({} as any);

      const result = await service.updateTaxAddress(
        mockUser as any,
        incompleteTaxDto,
      );

      expect(result.data.isTaxAddressCompleted).toBe(false);
    });

    it('should require tax number for US tax country', async () => {
      const usTaxDto: TaxAddressDto = {
        ...taxAddressDto,
        taxCountry: 'US',
        taxNumber: '', // Empty tax number
      };
      prismaService.taxAddress.upsert.mockResolvedValue({
        userId: 'user123',
        ...usTaxDto,
        isTaxAddressCompleted: false,
      } as any);
      prismaService.taxAddress.update.mockResolvedValue({} as any);

      const result = await service.updateTaxAddress(mockUser as any, usTaxDto);

      expect(result.data.isTaxAddressCompleted).toBe(false);
    });

    it('should not require tax number for non-US tax country', async () => {
      const nonUsTaxDto: TaxAddressDto = {
        ...taxAddressDto,
        taxCountry: 'UK',
        taxNumber: '', // Empty but should be ok for non-US
      };
      prismaService.taxAddress.upsert.mockResolvedValue({
        userId: 'user123',
        ...nonUsTaxDto,
        isTaxAddressCompleted: true,
      } as any);

      const result = await service.updateTaxAddress(
        mockUser as any,
        nonUsTaxDto,
      );

      expect(result.data.isTaxAddressCompleted).toBe(true);
    });
  });

  describe('verifyIdentityDocument', () => {
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

    beforeEach(() => {
      // Mock the Utility.uploadImage static method
      jest.spyOn(Utility, 'uploadImage').mockResolvedValue({
        url: 'https://cloudinary.com/id.jpg',
        public_id: 'id123',
      } as any);
      jest.spyOn(Utility, 'destroy').mockResolvedValue({} as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should throw BadRequestException if ID number is empty', async () => {
      const emptyIdDto = { ...identityDto, identityTypeNo: '' };

      await expect(
        service.verifyIdentityDocument('user123', emptyIdDto, mockFile),
      ).rejects.toThrow(new BadRequestException('ID number is required'));
    });

    it('should throw BadRequestException if file is not provided', async () => {
      await expect(
        service.verifyIdentityDocument('user123', identityDto, null),
      ).rejects.toThrow(
        new BadRequestException('Identity document image is required'),
      );
    });

    it('should throw BadRequestException for invalid NIN format', async () => {
      const invalidNinDto = { ...identityDto, identityTypeNo: '123' };

      await expect(
        service.verifyIdentityDocument('user123', invalidNinDto, mockFile),
      ).rejects.toThrow(
        new BadRequestException('Verification failed, invalid NIN'),
      );
    });

    it('should throw BadRequestException for invalid passport format', async () => {
      const invalidPassportDto = {
        ...identityDto,
        identityType: IdentityType.PASSPORT,
        identityTypeNo: '12',
      };

      await expect(
        service.verifyIdentityDocument('user123', invalidPassportDto, mockFile),
      ).rejects.toThrow(
        new BadRequestException('Invalid passport number format.'),
      );
    });

    it('should throw BadRequestException for invalid driver license format', async () => {
      const invalidLicenseDto = {
        ...identityDto,
        identityType: IdentityType.DRIVER_LICENSE,
        identityTypeNo: '123',
      };

      await expect(
        service.verifyIdentityDocument('user123', invalidLicenseDto, mockFile),
      ).rejects.toThrow(
        new BadRequestException('Verification failed, invalid licence number'),
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      usersService.getOne.mockResolvedValue(null);

      await expect(
        service.verifyIdentityDocument('user123', identityDto, mockFile),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if BVN not verified', async () => {
      const unverifiedUser = {
        ...mockUser,
        bvnVerified: DocumentVerificationStatus.NOT_VERIFIED,
      };
      usersService.getOne.mockResolvedValue(unverifiedUser as any);

      await expect(
        service.verifyIdentityDocument('user123', identityDto, mockFile),
      ).rejects.toThrow(
        new BadRequestException(
          'complete BVN verification and tax address information before verifying identity document',
        ),
      );
    });

    it('should return early if identity already verified', async () => {
      const verifiedUser = {
        ...mockUser,
        bvnVerified: DocumentVerificationStatus.PASSED,
        identityVerificationStatus: DocumentVerificationStatus.PASSED,
        kycLevel: KycLevel.TIER_2,
        taxAddress: { ...mockUser.taxAddress, isTaxAddressCompleted: true },
      };
      usersService.getOne.mockResolvedValue(verifiedUser as any);

      const result = await service.verifyIdentityDocument(
        'user123',
        identityDto,
        mockFile,
      );

      expect(result).toEqual({
        message: 'ID already verified',
        kycLevel: KycLevel.TIER_2,
        idVerified: true,
      });
      expect(dojahVerificationService.verifyIdentity).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if ID number already used by another user', async () => {
      const verifiedUser = {
        ...mockUser,
        bvnVerified: DocumentVerificationStatus.PASSED,
        taxAddress: { ...mockUser.taxAddress, isTaxAddressCompleted: true },
      };
      usersService.getOne
        .mockResolvedValueOnce(verifiedUser as any)
        .mockResolvedValueOnce({ id: 'otherUser' } as any);

      await expect(
        service.verifyIdentityDocument('user123', identityDto, mockFile),
      ).rejects.toThrow(
        new BadRequestException(
          'ID Number already registered to another account',
        ),
      );
    });

    it('should throw BadRequestException if identity verification fails', async () => {
      const verifiedUser = {
        ...mockUser,
        bvnVerified: DocumentVerificationStatus.PASSED,
        taxAddress: { ...mockUser.taxAddress, isTaxAddressCompleted: true },
      };
      usersService.getOne
        .mockResolvedValueOnce(verifiedUser as any)
        .mockResolvedValueOnce(null);
      dojahVerificationService.verifyIdentity.mockResolvedValue({
        status: 'failed',
        data: {},
      } as any);

      await expect(
        service.verifyIdentityDocument('user123', identityDto, mockFile),
      ).rejects.toThrow(new BadRequestException('ID verification failed'));
    });

    it('should successfully verify identity document and update user', async () => {
      const verifiedUser = {
        ...mockUser,
        bvnVerified: DocumentVerificationStatus.PASSED,
        taxAddress: { ...mockUser.taxAddress, isTaxAddressCompleted: true },
      };
      usersService.getOne
        .mockResolvedValueOnce(verifiedUser as any)
        .mockResolvedValueOnce(null);
      dojahVerificationService.verifyIdentity.mockResolvedValue({
        status: 'successful',
        data: {
          issue_place: 'Lagos',
          expiry_date: '2030-01-01',
          date_of_issue: '2020-01-01',
          gender: 'Male',
          date_of_birth: '1990-01-01',
        },
      } as any);
      prismaService.user.update.mockResolvedValue({
        ...verifiedUser,
        identityVerificationStatus: DocumentVerificationStatus.PASSED,
        kycLevel: KycLevel.TIER_2,
      } as any);

      const result = await service.verifyIdentityDocument(
        'user123',
        identityDto,
        mockFile,
      );

      expect(result).toEqual({
        message: `${identityDto.identityType} verified successfully`,
        kycLevel: KycLevel.TIER_2,
        idVerified: DocumentVerificationStatus.PASSED,
      });
      expect(Utility.uploadImage).toHaveBeenCalled();
      expect(prismaService.user.update).toHaveBeenCalled();
    });

    it('should rollback image upload if database update fails', async () => {
      const verifiedUser = {
        ...mockUser,
        bvnVerified: DocumentVerificationStatus.PASSED,
        taxAddress: { ...mockUser.taxAddress, isTaxAddressCompleted: true },
      };
      usersService.getOne
        .mockResolvedValueOnce(verifiedUser as any)
        .mockResolvedValueOnce(null);
      dojahVerificationService.verifyIdentity.mockResolvedValue({
        status: 'successful',
        data: {
          issue_place: 'Lagos',
          expiry_date: '2030-01-01',
          date_of_issue: '2020-01-01',
        },
      } as any);
      prismaService.user.update.mockRejectedValue(new Error('DB Error'));

      await expect(
        service.verifyIdentityDocument('user123', identityDto, mockFile),
      ).rejects.toThrow(
        new BadRequestException('Failed to update verification status'),
      );
      expect(Utility.destroy).toHaveBeenCalledWith('id123');
    });
  });

  describe('verifyUtility', () => {
    const utilityDto: UtilityVerificationDto = {
      utilityType: BillType.ELECTRICITY,
      employmentStatus: EmploymentStatus.employed,
      occupation: 'Software Engineer',
      primary_purpose: PrimaryPurposeUSDAccount.personal,
      source_of_funds: SourceOfFunds.salary,
      expected_monthly_inflow: 100000,
    };

    const mockFile = {
      fieldname: 'file',
      originalname: 'bill.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('test'),
      size: 1024,
    };

    beforeEach(() => {
      jest.spyOn(Utility, 'uploadImage').mockResolvedValue({
        url: 'https://cloudinary.com/bill.jpg',
        public_id: 'bill123',
      } as any);
      jest.spyOn(Utility, 'destroy').mockResolvedValue({} as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should throw BadRequestException if file is not provided', async () => {
      await expect(
        service.verifyUtility('user123', null, utilityDto),
      ).rejects.toThrow(
        new BadRequestException('Utility bill image is required'),
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      usersService.getOne.mockResolvedValue(null);

      await expect(
        service.verifyUtility('user123', mockFile, utilityDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if identity verification is not completed', async () => {
      const userWithoutIdentity = {
        ...mockUser,
        identityTypeUrl: null,
      };
      usersService.getOne.mockResolvedValue(userWithoutIdentity as any);

      await expect(
        service.verifyUtility('user123', mockFile, utilityDto),
      ).rejects.toThrow(
        new BadRequestException(
          'Identity document verification required before utility bill verification',
        ),
      );
    });

    it('should throw BadRequestException if utility bill verification fails', async () => {
      usersService.getOne.mockResolvedValue(mockUser as any);
      dojahVerificationService.verifyUtilityBillImage.mockResolvedValue({
        status: 'failed',
        data: {},
      } as any);

      await expect(
        service.verifyUtility('user123', mockFile, utilityDto),
      ).rejects.toThrow(
        new BadRequestException('Utility bill verification failed'),
      );
      expect(Utility.destroy).toHaveBeenCalledWith('bill123');
    });

    it('should throw BadRequestException if utility bill is not recent', async () => {
      usersService.getOne.mockResolvedValue(mockUser as any);
      dojahVerificationService.verifyUtilityBillImage.mockResolvedValue({
        status: 'successful',
        data: {
          metadata: { is_recent: false },
        },
      } as any);

      await expect(
        service.verifyUtility('user123', mockFile, utilityDto),
      ).rejects.toThrow(
        new BadRequestException(
          'Utility bill is not recent. Please upload one from the last 3 months.',
        ),
      );
      expect(Utility.destroy).toHaveBeenCalledWith('bill123');
    });

    it('should successfully verify utility bill and update user', async () => {
      usersService.getOne.mockResolvedValue(mockUser as any);
      dojahVerificationService.verifyUtilityBillImage.mockResolvedValue({
        status: 'successful',
        data: {
          metadata: { is_recent: true },
          identity_info: { meter_number: 'MTR123456' },
          provider_name: 'Electric Company',
          bill_issue_date: '2026-01-15',
        },
      } as any);
      graphService.createUSDPerson.mockResolvedValue({
        id: 'usd-person-123',
      } as any);
      walletService.createVirtualUSDAccount.mockResolvedValue({
        message: 'USD virtual account created successfully',
      } as any);
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        personIdUSD: 'usd-person-123',
        isUtilityBillVerified: true,
        kycLevel: KycLevel.TIER_2,
      } as any);

      const result = await service.verifyUtility(
        'user123',
        mockFile,
        utilityDto,
      );

      expect(result).toEqual({
        message: 'Utility bill verified successfully',
        kycLevel: KycLevel.TIER_2,
        isUtilityBillVerified: true,
      });
      expect(Utility.uploadImage).toHaveBeenCalled();
      expect(graphService.createUSDPerson).toHaveBeenCalledWith(
        expect.objectContaining({
          name_first: 'John',
          name_last: 'Doe',
          email: 'test@example.com',
          phone: '+2348012345678',
          documents: expect.arrayContaining([
            expect.objectContaining({ type: 'passport' }),
            expect.objectContaining({ type: 'utility_bill' }),
          ]),
        }),
      );
      expect(walletService.createVirtualUSDAccount).toHaveBeenCalledWith(
        'user123',
        'usd-person-123',
      );
      expect(prismaService.user.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: 'user123' },
          data: expect.objectContaining({
            personIdUSD: 'usd-person-123',
            isUtilityBillVerified: true,
            kycLevel: KycLevel.TIER_2,
            meterNumber: 'MTR123456',
            utilityProviderName: 'Electric Company',
            isBillRecent: true,
            utilityType: BillType.ELECTRICITY,
            utilityBillIssuedDate: expect.any(Date),
            utilityBillUrl: 'https://cloudinary.com/bill.jpg',
            utilityBillPublicId: 'bill123',
          }),
        }),
      );
    });

    it('should rollback image upload if database update fails', async () => {
      usersService.getOne.mockResolvedValue(mockUser as any);
      dojahVerificationService.verifyUtilityBillImage.mockResolvedValue({
        status: 'successful',
        data: {
          metadata: { is_recent: true },
          identity_info: { meter_number: 'MTR123456' },
          provider_name: 'Electric Company',
          bill_issue_date: '2026-01-15',
        },
      } as any);
      prismaService.user.update.mockRejectedValue(new Error('DB Error'));

      await expect(
        service.verifyUtility('user123', mockFile, utilityDto),
      ).rejects.toThrow(
        new BadRequestException(
          'Failed to update utility bill verification status',
        ),
      );
      expect(Utility.destroy).toHaveBeenCalledWith('bill123');
    });
  });
});
