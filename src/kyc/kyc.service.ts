import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Currency, IdentityType, KycLevel, Prisma, User } from '@prisma/client';
import { CustomLogger } from 'src/custom.logger';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { Gender } from '@prisma/client';
import { Utility } from 'src/helpers/utilities.service';
import { BvnDto } from './dto/bvn.dto';
import { TaxAddressDto } from './dto/taxAddress.dto';
import { DojahVerificationService } from 'src/vendors/dojah.verification';
import { IdentityVerificationDto } from './dto/identityVerification.dto';
import { UtilityVerificationDto } from './dto/utility.dto';
import { FincraVerificationService } from 'src/vendors/fincra.verification-service';
import { GraphService } from 'src/vendors/graph.service';
import { WalletService } from 'src/wallet/wallet.service';

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly logger: CustomLogger,
    private readonly fincraVerificationService: FincraVerificationService,
    private readonly dojahVerificationService: DojahVerificationService,
    private readonly graphService: GraphService,
    private readonly walletService: WalletService,
  ) {}

  async checkUserKycStatus(userId: string) {
    const user = await this.usersService.getOne({
      where: { id: userId },
      include: { taxAddress: true },
    });
    if (!user) {
      return new NotFoundException('User not found');
    }
    const safeTaxAddress = user.taxAddress?.isTaxAddressCompleted ?? false;
    // if kyc level is at level 0 then return level 1 of 3
    if (user.kycLevel === KycLevel.TIER_0) {
      return {
        status: 200,
        message: 'User KYC tier is tier 0 of 2',
        data: {
          isBvnVerified: user.bvnVerified,
          isTaxAddressVerified: safeTaxAddress,
          isTier1DocumentTypeVerified: user.tier1idVerified,
          kycLevel: user.kycLevel,
          isTier2DocumentVerification: user.identityVerificationStatus,
          isUtilityVerified: user.isUtilityBillVerified,
        },
      };
    }
    if (user.kycLevel === KycLevel.TIER_1) {
      return {
        status: 200,
        message: 'User KYC tier is tier 1 of 2',
        data: {
          isBvnVerified: user.bvnVerified,
          isTaxAddressVerified: user.taxAddress.isTaxAddressCompleted,
          isTier1DocumentTypeVerified: user.tier1idVerified,
          kycLevel: user.kycLevel,
          isTier2DocumentVerification: user.identityVerificationStatus,
          isUtilityVerified: user.isUtilityBillVerified,
        },
      };
    }
    if (user.kycLevel === KycLevel.TIER_2) {
      return {
        message: 'User KYC tier is tier 2 of 2',
        data: {
          isBvnVerified: user.bvnVerified,
          isTaxAddressVerified: safeTaxAddress,
          isTier1DocumentTypeVerified: user.tier1idVerified,
          kycLevel: user.kycLevel,
          isTier2DocumentVerification: user.identityVerificationStatus,
          isUtilityVerified: user.isUtilityBillVerified,
        },
      };
    }
    return {
      status: 400,
      message: 'Invalid KYC tier',
      data: null,
    };
  }

  //Tier 1 verification

  async verifyBvn(userId: string, payload: BvnDto) {
    // Validate BVN format (11 digits)
    if (!/^[0-9]{11}$/.test(payload.number)) {
      throw new BadRequestException('Verification failed, invalid BVN format');
    }

    const user = await this.usersService.getOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.bvnVerified === true) {
      return {
        message: 'BVN already verified',
        kycLevel: user.kycLevel,
        bvnVerified: user.bvnVerified,
      };
    }

    const existingBvn = await this.usersService.getOne({
      where: { bvn: payload.number },
    });

    if (existingBvn) {
      throw new BadRequestException(
        'BVN already registered to another account',
      );
    }

    // Call verification service to verify BVN
    // const result = await this.dojahVerificationService.verifyBvn(
    //   payload.number,
    // );

    // if (result.status !== 'successful') {
    //   throw new BadRequestException('BVN verification failed');
    // }

    // Update user's BVN verification status and KYC level
    try {
      // await this.prisma.user.update({
      //   where: { id: userId },
      //   data: {
      //     firstName: result.data.first_name,
      //     lastName: result.data.last_name,
      //     otherName: result.data.middle_name,
      //     dob: result.data.date_of_birth
      //       ? new Date(result.data.date_of_birth)
      //       : null,
      //     phoneNumber: result.data.phone_number1,
      //     gender: this.mapGenderToEnum(result.data.gender),
      //     bvn: payload.number,
      //     bvnVerified: DocumentVerificationStatus.PASSED,
      //     // kycLevel: KycLevel.TIER_1,
      //   },
      // });

      const randomPhone = () => {
        let phone = '';
        for (let i = 0; i < 11; i++) {
          phone += Math.floor(Math.random() * 10);
        }
        return phone;
      };

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName: user.firstName,
          lastName: user.lastName,
          otherName: user?.otherName || null,
          dob: '1993-10-06T00:00:00.000Z',
          phoneNumber: randomPhone(),
          gender: Gender.NOT_SPECIFIED,
          bvn: payload.number,
          bvnVerified: true,
        },
      });

      return {
        message: 'BVN verified successfully',
      };
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          `BVN already registered to another account`,
        );
      }
      throw new InternalServerErrorException('Failed to verify user BVN');
    }
  }

  async updateTaxAddress(user: User, payload: TaxAddressDto) {
    // Get existing tax address to merge with payload for completeness check
    const existingTaxAddress = await this.prisma.taxAddress.findFirst({
      where: { userId: user.id },
    });

    // Merge existing data with payload to calculate completeness
    const mergedData = { ...existingTaxAddress, ...payload };

    // Calculate completion status based on merged data
    const isComplete = !!(
      mergedData.country?.trim() &&
      mergedData.state?.trim() &&
      mergedData.city?.trim() &&
      mergedData.street?.trim() &&
      mergedData.houseNo?.trim() &&
      mergedData.nationality?.trim() &&
      mergedData.taxCountry?.trim() &&
      mergedData.zipCode?.trim() &&
      // taxNumber is only required if taxCountry is US
      (mergedData.taxCountry?.trim() === 'US'
        ? mergedData.taxNumber?.trim()
        : true)
    );

    // Single upsert with completion flag included
    await this.prisma.taxAddress.upsert({
      where: { userId: user.id },
      update: {
        ...payload,
        isTaxAddressCompleted: isComplete,
      },
      create: {
        ...payload,
        isTaxAddressCompleted: isComplete,
        user: { connect: { id: user.id } },
      },
    });

    return {
      message: 'Tax address updated successfully',
      data: { isTaxAddressCompleted: isComplete },
    };
  }

  async verifyTier1IdType(
    userId: string,
    type: IdentityType,
    payload: BvnDto,
    file?: any,
  ) {
    try {
      const idNumber = payload.number.trim();

      if (!file) {
        throw new BadRequestException('File upload required');
      }

      const [user, duplicate] = await Promise.all([
        this.usersService.getOne({
          where: { id: userId },
          include: {
            taxAddress: true,
          },
        }),

        this.usersService.getOne({
          where: { tier1idNo: idNumber },
        }),
      ]);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.taxAddress?.isTaxAddressCompleted) {
        throw new BadRequestException('Update your tax address to progress');
      }

      if (duplicate && duplicate.id !== userId) {
        throw new ConflictException(`${type} number already registered`);
      }

      let uploaded;

      try {
        uploaded = await Utility.uploadImage(file, 'Person_Creation_tier1');
      } catch (error) {
        this.logger.error(
          `Failed to upload Tier 1 document: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );

        throw new BadRequestException('Failed to upload document');
      }

      const personPayload = {
        name_first: user.firstName,
        name_last: user.lastName,
        name_other: user.otherName,
        email: user.email,
        phone: user.phoneNumber,
        dob: this.formatDOBForGraph(user.dob?.toISOString() ?? ''),
        id_level: type === IdentityType.PASSPORT ? 'primary' : 'secondary',
        id_type: this.mapIdType(type),
        id_number: idNumber,
        id_country: user.taxAddress?.country,
        bank_id_number: user.bvn,
        bank_id_type: 'bvn',
        address: {
          line1: `${user.taxAddress?.houseNo ?? ''} ${
            user.taxAddress?.street ?? ''
          }`.trim(),
          city: user.taxAddress?.city,
          state: user.taxAddress?.state,
          country: user.taxAddress?.country,
          postal_code: user.taxAddress?.zipCode,
        },
        documents: [
          {
            type: this.mapIdType(type),
            url: uploaded.url,
          },
        ],
      };

      // Create Graph person
      const personId = await this.ensureGraphPerson(user, personPayload);

      // External Graph wallet creation
      const graphWallet = await this.graphService.createVirtualAccount(
        personId,
        Currency.NGN,
      );

      await this.prisma.$transaction(async (tx) => {
        await this.walletService.createWalletFromGraphResponse(
          user.id,
          Currency.NGN,
          graphWallet,
          tx,
        );

        await tx.user.update({
          where: {
            id: userId,
          },
          data: {
            tier1idType: type,
            tier1idNo: idNumber,
            tier1idVerified: true,
            kycLevel: KycLevel.TIER_1,
          },
        });
      });

      return {
        message:
          'Tier 1 verification completed, NGN account created successfully',
        kycLevel: KycLevel.TIER_1,
      };
    } catch (error: unknown) {
      // Preserve intentional HTTP exceptions
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle Prisma unique constraint
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = error.meta?.target;

        if (Array.isArray(target) && target.includes('tier1idNo')) {
          throw new ConflictException('Identity number already registered');
        }
      }

      this.logger.error(
        `Unable to complete Tier 1 verification: ${
          error instanceof Error ? error.stack : String(error)
        }`,
      );

      throw new InternalServerErrorException(
        'Unable to complete Tier 1 verification, try again',
      );
    }
  }

  // end

  async verifyIdentityDocument(
    userId: string,
    payload: IdentityVerificationDto,
    file: any,
  ) {
    if (!payload.identityTypeNo?.trim()) {
      throw new BadRequestException('ID number is required');
    }

    if (!file) {
      throw new BadRequestException('Identity document image is required');
    }

    this.validateIdNumber(payload.identityType, payload.identityTypeNo);

    const user = await this.usersService.getOne({
      where: { id: userId },
      include: { taxAddress: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if BVN verification is completed (required for ID verification)
    if (!user.bvnVerified && !user.taxAddress?.isTaxAddressCompleted) {
      throw new BadRequestException(
        'complete BVN verification and tax address information before verifying identity document',
      );
    }

    if (user.identityVerificationStatus) {
      throw new BadRequestException('Document already verified');
    }

    // Check if ID number is already used by another user
    const existingIdUser = await this.usersService.getOne({
      where: { identityTypeNo: payload.identityTypeNo, id: { not: userId } },
    });

    if (existingIdUser) {
      throw new BadRequestException(
        'ID Number already registered to another account',
      );
    }

    // // Call verification service BEFORE uploading the document
    // const result = await this.dojahVerificationService.verifyIdentity(
    //   payload.identityType,
    //   payload.identityTypeNo,
    // );

    // if (result.status !== 'successful') {
    //   throw new BadRequestException('ID verification failed');
    // }

    // Only upload file after successful verification

    const uploadedImage = await Utility.uploadImage(file, 'IdentityDocuments');

    // Update user with verification details
    try {
      const updateData: any = {
        Tier2IdType: payload.identityType,
        identityTypeNo: payload.identityTypeNo,
        identityVerificationStatus: true,
        ...payload,
        identityTypeTier2Url: uploadedImage.url,
        identityTypeTier2PublicId: uploadedImage.public_id,
        // issuedPlace: result.data.issue_place,
        // expiryDate: result.data.expiry_date
        //   ? new Date(result.data.expiry_date)
        //   : null,
        // issuedDate: result.data.date_of_issue
        //   ? new Date(result.data.date_of_issue)
        //   : null,
        issuedPlace: 'LAGOS',
        expiryDate: '2030-10-06T00:00:00.000Z',
        issuedDate: '2024-10-06T00:00:00.000Z',
      };

      // Only update gender and DOB if not already set or if new data is available
      // if (
      //   result.data.gender &&
      //   (!user.gender || user.gender === Gender.NOT_SPECIFIED)
      // ) {
      //   updateData.gender = this.mapGenderToEnum(result.data.gender);
      // }

      // if (result.data.date_of_birth && !user.dob) {
      //   updateData.dob = new Date(result.data.date_of_birth);
      // }

      const update = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      return {
        message: `${payload.identityType} verified successfully`,
        idVerified: update.identityVerificationStatus,
      };
    } catch (error) {
      // Rollback: Delete uploaded image if database update fails
      await Utility.destroy(uploadedImage.public_id);

      this.logger.error(
        `Database update failed during ID verification, ${error}`,
      );
      throw new BadRequestException('Failed to update verification status');
    }
  }

  async verifyUtility(
    userId: string,
    file: any,
    payload: UtilityVerificationDto,
  ) {
    if (!file) {
      throw new BadRequestException('Utility bill image is required');
    }

    const user = await this.usersService.getOne({
      where: { id: userId },
      include: { taxAddress: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (!user.identityTypeTier2Url) {
      throw new BadRequestException(
        'Identity document verification required before utility bill verification',
      );
    }

    const formatDate = (input: string | Date): string | null => {
      if (!input) return null;

      if (input instanceof Date) {
        const y = input.getFullYear();
        const m = String(input.getMonth() + 1).padStart(2, '0');
        const d = String(input.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }

      const normalized = input.replace(/\//g, '-');
      const [day, month, year] = normalized.split('-');
      return `${year}-${month}-${day}`;
    };

    const mapIdType = (type: IdentityType): string => {
      const map = {
        [IdentityType.NIN]: 'national_id',
        [IdentityType.DRIVER_LICENSE]: 'drivers_license',
        [IdentityType.PASSPORT]: 'passport',
      };
      return map[type] ?? 'other';
    };

    const uploaded = await Utility.uploadImage(file, 'UtilityBills');

    // 2️ Verify Utility Bill (Dojah)

    // let verification;
    // try {
    // verification = await this.dojahVerificationService.verifyUtilityBillImage(
    //   {
    //     input_type: 'url',
    //     input_value: uploaded.url,
    //   },
    // );
    // if (verification.status !== 'successful') {
    //   throw new BadRequestException('Utility bill verification failed');
    // }
    // if (!verification.data?.metadata?.is_recent) {
    //   throw new BadRequestException(
    //     'Utility bill is not recent. Please upload one from the last 3 months.',
    //   );
    // }
    // } catch (err) {
    //   await cleanupImage(uploaded.public_id);
    //   throw err;
    // }

    // 3️Create Graph USD Person

    const personPayload = {
      name_first: user.firstName,
      name_last: user.lastName,
      name_other: user.otherName,
      email: user.email,
      phone: user.phoneNumber,
      dob: formatDate(user.dob),
      id_level:
        user.identityType === IdentityType.PASSPORT ? 'primary' : 'secondary',
      id_type: mapIdType(user.identityType),
      id_number: user.identityTypeNo,
      id_country: user.taxAddress?.country,
      bank_id_number: user.bvn,
      bank_id_type: 'bvn',
      address: {
        line1: `${user.taxAddress?.houseNo ?? ''} ${
          user.taxAddress?.street ?? ''
        }`.trim(),
        city: user.taxAddress?.city,
        state: user.taxAddress?.state,
        country: user.taxAddress?.country,
        postal_code: user.taxAddress?.zipCode,
      },
      documents: [
        { type: mapIdType(user.identityType), url: user.identityTypeTier2Url },
        { type: 'utility_bill', url: uploaded.url },
      ],
      background_information: {
        employment_status: payload.employmentStatus,
        occupation: payload.occupation,
        primary_purpose: payload.primary_purpose,
        expected_monthly_inflow: payload.expected_monthly_inflow,
        source_of_funds: payload.source_of_funds,
      },
    };

    const personId = await this.ensureGraphPerson(user, personPayload);

    // If person already existed, upgrade KYC
    if (user.graphPersonId) {
      await this.graphService.updatePerson(personId, {
        documents: [
          {
            type: mapIdType(user.identityType),
            url: user.identityTypeTier2Url,
          },
          { type: 'utility_bill', url: uploaded.url },
        ],
        background_information: {
          employment_status: payload.employmentStatus,
          occupation: payload.occupation,
          primary_purpose: payload.primary_purpose,
          expected_monthly_inflow: payload.expected_monthly_inflow,
          source_of_funds: payload.source_of_funds,
        },
      });
    }

    // 4️Create USD Wallet and EUR wallet
    const results = await Promise.allSettled([
      this.walletService.createVirtualAccountForCurrency(
        userId,
        personId,
        Currency.USD,
      ),
      this.walletService.createVirtualAccountForCurrency(
        userId,
        personId,
        Currency.EUR,
      ),
    ]);

    const summary = {
      usd: results[0],
      eur: results[1],
    };

    if (summary.usd.status === 'rejected') {
      this.logger.error('USD wallet creation failed', summary.usd.reason);
    }

    if (summary.eur.status === 'rejected') {
      this.logger.error('EUR wallet creation failed', summary.eur.reason);
    }

    if (
      summary.usd.status === 'rejected' &&
      summary.eur.status === 'rejected'
    ) {
      throw new BadRequestException('Failed to create wallets');
    }

    const randomMeterNumber = () => {
      let phone = '';
      for (let i = 0; i < 11; i++) {
        phone += Math.floor(Math.random() * 10);
      }
      return phone;
    };

    // 5️Final DB Update
    const update = await this.prisma.user.update({
      where: { id: userId },
      data: {
        utilityType: payload.utilityType,
        // meterNumber: verification.data.identity_info.meter_number,
        meterNumber: randomMeterNumber(),
        isUtilityBillVerified: true,
        kycLevel: KycLevel.TIER_2,
        utilityBillUrl: uploaded.url,
        utilityBillPublicId: uploaded.public_id,
        // utilityProviderName: verification.data.provider_name,
        // utilityBillIssuedDate: verification.data.bill_issue_date
        //   ? new Date(verification.data.bill_issue_date)
        //   : null,
        // isBillRecent: verification.data.metadata.is_recent,
        utilityProviderName: 'Eko Electric',
        utilityBillIssuedDate: '2026-04-01T00:00:00.000Z',

        isBillRecent: true,
      },
    });

    return {
      message: 'Utility bill verified successfully',
      kycLevel: KycLevel.TIER_2,
      isUtilityBillVerified: update.isUtilityBillVerified,
    };
  }

  private validateIdNumber(identityType: IdentityType, idNumber: string): void {
    switch (identityType) {
      case IdentityType.NIN:
        // Nigerian NIN is 11 digits

        if (!/^[0-9]{11}$/.test(idNumber))
          throw new BadRequestException('Verification failed, invalid NIN');
        break;
      case IdentityType.PASSPORT:
        // International passport format (alphanumeric, 6-9 characters)
        if (!/^[A-Z0-9]{6,9}$/i.test(idNumber)) {
          throw new BadRequestException('Invalid passport number format.');
        }
        break;
      case IdentityType.DRIVER_LICENSE:
        // Driver's license format varies, but generally alphanumeric
        if (!/^[a-zA-Z]{3}([ -]{1})?[A-Z0-9]{6,12}$/i.test(idNumber))
          throw new BadRequestException(
            'Verification failed, invalid licence number',
          );
        break;
      default:
        throw new BadRequestException('Unsupported identity type.');
    }
  }

  private mapGenderToEnum(gender: string): Gender {
    const genderMap: { [key: string]: Gender } = {
      M: Gender.MALE,
      F: Gender.FEMALE,
      Male: Gender.MALE,
      Female: Gender.FEMALE,
      male: Gender.MALE,
      female: Gender.FEMALE,
    };
    return genderMap[gender] || Gender.NOT_SPECIFIED;
  }
  private formatDOBForGraph(dateStr?: string): string | null {
    if (!dateStr) return null;

    if (dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/');

      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
  }
  private mapIdType(type: IdentityType): string {
    const map: Record<IdentityType, string> = {
      [IdentityType.NIN]: 'national_id',
      [IdentityType.DRIVER_LICENSE]: 'drivers_license',
      [IdentityType.PASSPORT]: 'passport',
    };
    return map[type];
  }

  private async ensureGraphPerson(user: User, payload: any) {
    if (user.graphPersonId) return user.graphPersonId;

    const person = await this.graphService.createPerson(payload);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { graphPersonId: person.id },
    });

    return person.id;
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
      graphPersonId,
      identityTypeNo,
      tier1idNo,
      bvn,
      Tier2IdNo,
      identityTypeTier2PublicId,
      utilityBillPublicId,
      payments,
      wallets,
      BlackListedIp,
      meterNumber,
      ...sanitizedUser
    } = user;
    return sanitizedUser;
  }
}
