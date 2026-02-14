import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentVerificationStatus,
  IdentityType,
  KycLevel,
  User,
} from '@prisma/client';
import { K } from 'handlebars';
import { use } from 'passport';
import { CustomLogger } from 'src/custom.logger';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { VerificationService } from 'src/vendors/verification-service';
import { Gender } from '@prisma/client';
import { Utility } from 'src/helpers/utilities.service';
import { BvnDto } from './dto/bvn.dto';
import { TaxAddressDto } from './dto/taxAddress.dto';
import { connect } from 'http2';
import { DojahVerificationService } from 'src/vendors/dojah.verification';
import { IdentityVerificationDto } from './dto/identityVerification.dto';
import { UtilityVerificationDto } from './dto/utility.dto';

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly logger: CustomLogger,
    private readonly verificationService: VerificationService,
    private readonly dojahVerificationService: DojahVerificationService,
  ) {}

  async checkUserKycStatus(userId: string) {
    const user = await this.usersService.getOne({ id: userId });
    if (!user) {
      return new NotFoundException('User not found');
    }

    // if kyc level is at level 0 then return level 1 of 3
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

  async verifyBvn(userId: string, payload: BvnDto) {
    // Validate BVN format (11 digits)
    if (!/^[0-9]{11}$/.test(payload.bvn)) {
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
    const existingBvn = await this.prisma.user.findFirst({
      where: {
        bvn: payload.bvn,
        id: { not: userId },
      },
    });

    if (existingBvn) {
      throw new BadRequestException(
        'BVN already registered to another account',
      );
    }

    // Call verification service
    const result = await this.verificationService.verifyBvn(payload);

    if (result.data.verificationStatus !== 'verified') {
      throw new BadRequestException('BVN verification failed');
    }

    // Update user's BVN verification status and KYC level
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: result.data.response.firstName,
        lastName: result.data.response.lastName,
        otherName: result.data.response.middleName,
        dob: result.data.response.dateOfBirth
          ? new Date(result.data.response.dateOfBirth)
          : null,
        phoneNumber: result.data.response.phoneNo,
        gender: this.mapGenderToEnum(result.data.response.gender),
        bvn: payload.bvn,
        bvnVerified: DocumentVerificationStatus.PASSED,
        kycLevel: KycLevel.TIER_1,
      },
    });

    return {
      message: 'BVN verified successfully',
      kycLevel: KycLevel.TIER_1,
    };
  }

  async updateTaxAddress(user: User, payload: TaxAddressDto) {
    const updatedTaxAddress = await this.prisma.taxAddress.upsert({
      where: { userId: user.id },
      update: payload,
      create: {
        ...payload,
        user: { connect: { id: user.id } },
      },
    });

    const isComplete = !!(
      updatedTaxAddress.country?.trim() &&
      updatedTaxAddress.state?.trim() &&
      updatedTaxAddress.city?.trim() &&
      updatedTaxAddress.street?.trim() &&
      updatedTaxAddress.houseNo?.trim() &&
      updatedTaxAddress.nationality?.trim() &&
      updatedTaxAddress.taxCountry?.trim() &&
      updatedTaxAddress.zipCode?.trim() &&
      // taxNumber is only required if taxCountry is US
      (updatedTaxAddress.taxCountry?.trim() === 'US'
        ? updatedTaxAddress.taxNumber?.trim()
        : true)
    );

    // Update the completion flag if needed
    if (updatedTaxAddress.isTaxAddressCompleted !== isComplete) {
      await this.prisma.taxAddress.update({
        where: { userId: user.id },
        data: { isTaxAddressCompleted: isComplete },
      });
    }

    return {
      message: 'Tax address updated successfully',
      data: { isTaxAddressCompleted: isComplete },
    };
  }

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
      user.taxAddress.isTaxAddressCompleted !== true
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
        identityType: payload.identityType,
        identityTypeNo: payload.identityTypeNo,
        identityVerificationStatus: DocumentVerificationStatus.PASSED,
        kycLevel: KycLevel.TIER_2,
        ...payload,
        identityTypeUrl: uploadedImage.url,
        identityTypePublicId: uploadedImage.public_id,
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
        kycLevel: KycLevel.TIER_2,
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

    // Fetch user and check prerequisites
    const user = await this.usersService.getOne({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Upload utility bill image to Cloudinary first
    let uploadedImage;
    try {
      uploadedImage = await Utility.uploadImage(file, 'UtilityBills');
    } catch (error) {
      this.logger.error(
        'Image upload failed during utility bill verification',
        error,
      );
      throw new BadRequestException('Failed to upload utility bill');
    }

    // Verify the utility bill using Dojah
    let result;
    try {
      result = await this.dojahVerificationService.verifyUtilityBillImage({
        input_type: 'url',
        input_value: uploadedImage.url,
      });

      // Check if verification was successful
      if (result.status !== 'successful') {
        throw new BadRequestException('Utility bill verification failed');
      }

      // Ensure the bill is recent (within 3 months)
      if (!result.data.metadata.is_recent) {
        throw new BadRequestException(
          'Utility bill is not recent. Please upload a bill from the last 3 months.',
        );
      }
    } catch (error) {
      // Cleanup: Delete uploaded image if verification fails
      try {
        await Utility.destroy(uploadedImage.public_id);
      } catch (deleteError) {
        this.logger.error(
          'Failed to cleanup uploaded image after verification failure',
          deleteError,
        );
      }
      throw error; // Re-throw the original error
    }

    // Update user with verification details
    try {
      const updateData: any = {
        ...payload,
        meterNumber: result.data.identity_info.meter_number,
        isUtilityBillVerified: true,
        kycLevel: KycLevel.TIER_2,
        utilityBillUrl: uploadedImage.url,
        utilityBillPublicId: uploadedImage.public_id,
        utilityProviderName: result.data.provider_name,
        utilityBillIssuedDate: result.data.bill_issue_date
          ? new Date(result.data.bill_issue_date)
          : null,
        isBillRecent: result.data.metadata.is_recent,
      };

      const update = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      return {
        message: 'Utility bill verified successfully',
        kycLevel: KycLevel.TIER_2,
        isUtilityBillVerified: update.isUtilityBillVerified,
      };
    } catch (error) {
      // Rollback: Delete uploaded image if database update fails
      try {
        await Utility.destroy(uploadedImage.public_id);
      } catch (deleteError) {
        this.logger.error('Failed to rollback image upload', deleteError);
      }

      this.logger.error(
        'Database update failed during utility bill verification',
        error,
      );
      throw new BadRequestException(
        'Failed to update utility bill verification status',
      );
    }
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
}
