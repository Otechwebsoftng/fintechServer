import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentVerificationStatus,
  IdentityType,
  KycLevel,
  User,
} from '@prisma/client';
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
    const user = await this.usersService.getOne({ id: userId });
    if (!user) {
      return new NotFoundException('User not found');
    }

    // if kyc level is at level 0 then return level 1 of 3
    if (user.kycLevel === KycLevel.TIER_0) {
      return {
        status: 200,
        message: 'user KYC tier is tier 0 of 2',
        data: user.kycLevel,
      };
    }
    if (user.kycLevel === KycLevel.TIER_1) {
      return {
        status: 200,
        message: 'user KYC tier is tier 1 of 2',
        data: user.kycLevel,
      };
    }
    if (user.kycLevel === KycLevel.TIER_2) {
      return {
        message: 'user KYC tier is tier 2 of 2',
        data: user.kycLevel,
      };
    }
  }

  //Tier 1 verification

  async verifyBvn(userId: string, payload: BvnDto) {
    // Validate BVN format (11 digits)
    if (!/^[0-9]{11}$/.test(payload.number)) {
      throw new BadRequestException('Verification failed, invalid BVN format');
    }

    const user = await this.usersService.getOne({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if BVN already verified
    if (user.bvnVerified === DocumentVerificationStatus.PASSED) {
      return {
        message: 'BVN already verified',
        kycLevel: user.kycLevel,
        bvnVerified: user.bvnVerified,
      };
    }

    // Check if BVN is already used by another user
    const existingBvn = await this.usersService.getOne({
      bvn: payload.number,
      // id: { not: userId },
    });

    if (existingBvn) {
      throw new BadRequestException(
        'BVN already registered to another account',
      );
    }

    // Call verification service to verify BVN
    const result = await this.dojahVerificationService.verifyBvn(
      payload.number,
    );

    if (result.status !== 'successful') {
      throw new BadRequestException('BVN verification failed');
    }

    // Update user's BVN verification status and KYC level
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName: result.data.first_name,
          lastName: result.data.last_name,
          otherName: result.data.middle_name,
          dob: result.data.date_of_birth
            ? new Date(result.data.date_of_birth)
            : null,
          phoneNumber: result.data.phone_number1,
          gender: this.mapGenderToEnum(result.data.gender),
          bvn: payload.number,
          bvnVerified: DocumentVerificationStatus.PASSED,
          // kycLevel: KycLevel.TIER_1,
        },
      });

      return {
        message: 'BVN verified successfully',
        kycLevel: KycLevel.TIER_1,
      };
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          `BVN already registered to another account: ${error.message}`,
        );
      }
      throw error;
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
    const idNumber = payload.number.trim();
    const normalizedType = type.trim();

    if (!file) {
      throw new BadRequestException('Utility bill image is required');
    }
    const [user, duplicate] = await Promise.all([
      this.usersService.getOne({ id: userId }),

      // Prevent duplicate ID usage
      this.usersService.getOne({
        tier1idType: normalizedType,
        tier1idNo: idNumber,
      }),
    ]);

    const cleanupImage = async (publicId?: string) => {
      if (!publicId) return;
      try {
        await Utility.destroy(publicId);
      } catch (err) {
        this.logger.error('Cloudinary cleanup failed', err);
      }
    };

    let uploaded;
    try {
      uploaded = await Utility.uploadImage(file, 'Person_Creation_tier1');
    } catch (err) {
      await cleanupImage(uploaded?.publicId);

      this.logger.error('Utility bill upload failed', err);
      throw new BadRequestException('Failed to upload utility bill');
    }

    if (!user) throw new NotFoundException('User not found');

    if (duplicate && duplicate.id !== userId) {
      throw new ConflictException({
        success: false,
        message: `${type} number already registered `,
        code: 'DUPLICATE_ID',
      });
    }

    // Verification strategy
    const verificationHandlers: Record<
      IdentityType,
      (id: string) => Promise<any>
    > = {
      [IdentityType.NIN]: (id) => this.dojahVerificationService.verifyNin(id),

      [IdentityType.DRIVER_LICENSE]: (id) =>
        this.dojahVerificationService.verifyDriversLicense(id),

      [IdentityType.PASSPORT]: (id) =>
        this.dojahVerificationService.internationalPassport(id),
    };

    const verify = verificationHandlers[type];
    if (!verify) throw new BadRequestException('Unsupported identity type');

    const result = await verify(idNumber);

    if (result.status !== 'successful') {
      throw new BadRequestException(
        `${type} verification failed: ${result.message}`,
      );
    }

    // Update Tier 1 verification
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        tier1idType: type,
        tier1idNo: idNumber,
        tier1idVerified: DocumentVerificationStatus.PASSED,
        kycLevel: KycLevel.TIER_1,
      },
    });

    const formatBirthDate = (dateStr: string): string => {
      if (!dateStr) return null;
      const normalized = dateStr.replace(/\//g, '-');
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

    const personPayload = {
      name_first: user.firstName,
      name_last: user.lastName,
      name_other: user.otherName,
      email: user.email,
      phone: user.phoneNumber,
      dob: formatBirthDate(result.data?.date_of_birth),
      id_level: type === IdentityType.PASSPORT ? 'primary' : 'secondary', // Passports are often considered primary IDs
      id_type: mapIdType(type),
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
      documents: [{ url: uploaded.url }],
    };

    // 1️Create Person (Graph)

    const personId = await this.ensureGraphPerson(user, personPayload);

    // 2️ Create Wallet
    await this.walletService.createVirtualNGNAccount(user.id, personId);

    return {
      message:
        'Tier 1 verification completed, NGN account created successfully',
      kycLevel: KycLevel.TIER_1,
    };
  }

  // end

  async verifyIdentityDocument(
    userId: string,
    payload: IdentityVerificationDto,
    file: any,
  ) {
    // Validate inputs early
    if (!payload.identityTypeNo?.trim()) {
      throw new BadRequestException('ID number is required');
    }

    if (!file) {
      throw new BadRequestException('Identity document image is required');
    }

    this.validateIdNumber(payload.identityType, payload.identityTypeNo);

    // Fetch user and check prerequisites
    const user = await this.usersService.getOne({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if BVN verification is completed (required for ID verification)
    if (
      user.bvnVerified !== DocumentVerificationStatus.PASSED &&
      user.taxAddress?.isTaxAddressCompleted !== true
    ) {
      throw new BadRequestException(
        'complete BVN verification and tax address information before verifying identity document',
      );
    }

    // Early return if already verified
    if (user.identityVerificationStatus === DocumentVerificationStatus.PASSED) {
      return {
        message: 'ID already verified',
        kycLevel: user.kycLevel,
        idVerified: true,
      };
    }

    // Check if ID number is already used by another user (more efficient query)
    const existingIdUser = await this.usersService.getOne({
      identityTypeNo: payload.identityTypeNo,
      id: { not: userId },
    });

    if (existingIdUser) {
      throw new BadRequestException(
        'ID Number already registered to another account',
      );
    }

    // Call verification service BEFORE uploading the document
    const result = await this.dojahVerificationService.verifyIdentity(
      payload.identityType,
      payload.identityTypeNo,
    );

    if (result.status !== 'successful') {
      throw new BadRequestException('ID verification failed');
    }

    // Only upload file after successful verification
    let uploadedImage;
    try {
      uploadedImage = await Utility.uploadImage(file, 'IdentityDocuments');
    } catch (error) {
      this.logger.error('Image upload failed during ID verification', error);
      throw new BadRequestException('Failed to upload identity document');
    }

    // Update user with verification details
    try {
      const updateData: any = {
        Tier2IdType: payload.identityType,
        identityTypeNo: payload.identityTypeNo,
        identityVerificationStatus: DocumentVerificationStatus.PASSED,
        ...payload,
        identityTypeTier2Url: uploadedImage.url,
        identityTypeTier2PublicId: uploadedImage.public_id,
        issuedPlace: result.data.issue_place,
        expiryDate: result.data.expiry_date
          ? new Date(result.data.expiry_date)
          : null,
        issuedDate: result.data.date_of_issue
          ? new Date(result.data.date_of_issue)
          : null,
      };

      // Only update gender and DOB if not already set or if new data is available
      if (
        result.data.gender &&
        (!user.gender || user.gender === Gender.NOT_SPECIFIED)
      ) {
        updateData.gender = this.mapGenderToEnum(result.data.gender);
      }

      if (result.data.date_of_birth && !user.dob) {
        updateData.dob = new Date(result.data.date_of_birth);
      }

      const update = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      return {
        message: `${payload.identityType} verified successfully`,
        // kycLevel: KycLevel.TIER_2,
        idVerified: update.identityVerificationStatus,
      };
    } catch (error) {
      // Rollback: Delete uploaded image if database update fails
      try {
        await Utility.destroy(uploadedImage.public_id);
      } catch (deleteError) {
        this.logger.error('Failed to rollback image upload', deleteError);
      }

      this.logger.error('Database update failed during ID verification', error);
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

    const user = await this.usersService.getOne({ id: userId });
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

    const cleanupImage = async (publicId?: string) => {
      if (!publicId) return;
      try {
        await Utility.destroy(publicId);
      } catch (err) {
        this.logger.error('Cloudinary cleanup failed', err);
      }
    };

    let uploaded;
    try {
      uploaded = await Utility.uploadImage(file, 'UtilityBills');
    } catch (err) {
      this.logger.error('Utility bill upload failed', err);
      throw new BadRequestException('Failed to upload utility bill');
    }

    // 2️ Verify Utility Bill (Dojah)

    let verification;
    try {
      verification = await this.dojahVerificationService.verifyUtilityBillImage(
        {
          input_type: 'url',
          input_value: uploaded.url,
        },
      );

      if (verification.status !== 'successful') {
        throw new BadRequestException('Utility bill verification failed');
      }

      // if (!verification.data?.metadata?.is_recent) {
      //   throw new BadRequestException(
      //     'Utility bill is not recent. Please upload one from the last 3 months.',
      //   );
      // }
    } catch (err) {
      await cleanupImage(uploaded.public_id);
      throw err;
    }

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
      this.walletService.createVirtualUSDAccount(userId, personId),
      this.walletService.createVirtualEURAccount(userId, personId),
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

    // 5️Final DB Update
    const update = await this.prisma.user.update({
      where: { id: userId },
      data: {
        utilityType: payload.utilityType,
        meterNumber: verification.data.identity_info.meter_number,
        isUtilityBillVerified: true,
        kycLevel: KycLevel.TIER_2,
        utilityBillUrl: uploaded.url,
        utilityBillPublicId: uploaded.public_id,
        utilityProviderName: verification.data.provider_name,
        utilityBillIssuedDate: verification.data.bill_issue_date
          ? new Date(verification.data.bill_issue_date)
          : null,
        isBillRecent: verification.data.metadata.is_recent,
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

  private async ensureGraphPerson(user: User, payload: any) {
    if (user.graphPersonId) return user.graphPersonId;

    console.log(`existing graph person: ${user.graphPersonId}`);

    const person = await this.graphService.createPerson(payload);
    console.log({ graphPersonPayload: payload, graphPerson: person });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { graphPersonId: person.id },
    });

    return person.id;
  }
}
