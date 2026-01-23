import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentVerificationStatus,
  IdentityType,
  KycLevel,
} from '@prisma/client';
import { K } from 'handlebars';
import { use } from 'passport';
import { CustomLogger } from 'src/custom.logger';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { VerificationService } from 'src/vendors/verification-service';
import { Gender } from '@prisma/client';

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly logger: CustomLogger,
    private readonly verificationService: VerificationService,
  ) {}

  async checkUserKycStatus(userId: string) {
    const user = await this.usersService.getOne({ id: userId });
    if (!user) {
      return new NotFoundException('User not found');
    }

    // if kyc level is at level 0 then return level 1 of 3
    if (user.kycLevel === KycLevel.LEVEL_0) {
      return {
        status: 200,
        message: 'user KYC level is Level 0 of 3',
        data: user.kycLevel,
      };
    }
    if (user.kycLevel === KycLevel.LEVEL_1) {
      return {
        message: 'user KYC level is Level 1 of 3',
        data: user.kycLevel,
      };
    }
    if (user.kycLevel === KycLevel.LEVEL_2) {
      return {
        message: 'user KYC level is Level 2 of 3',
        data: user.kycLevel,
      };
    }
    if (user.kycLevel === KycLevel.LEVEL_3) {
      return {
        message: 'user KYC level is Level 3 of 3',
        data: user.kycLevel,
      };
    }

    // return user.kycLevel;
  }

  async verifyBvn(userId: string, bvn: string) {
    // Validate BVN format (11 digits)
    if (!/^[0-9]{11}$/.test(bvn)) {
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
        bvn,
        id: { not: userId },
      },
    });

    if (existingBvn) {
      throw new BadRequestException(
        'BVN already registered to another account',
      );
    }

    // Call verification service
    const result = await this.verificationService.verifyBvn(bvn);
    console.log('BVN verification result:', result);

    if (result.status !== 'successful') {
      throw new BadRequestException('BVN verification failed');
    }

    // Update user's BVN verification status and KYC level
    const update = await this.prisma.user.update({
      where: { id: userId },
      data: {
        dob: result.data.date_of_birth
          ? new Date(result.data.date_of_birth)
          : null,
        gender: this.mapGenderToEnum(result.data.gender),
        bvn,
        bvnVerified: DocumentVerificationStatus.PASSED,
        kycLevel: KycLevel.LEVEL_1,
      },
    });

    return {
      message: 'BVN verified successfully',
      kycLevel: KycLevel.LEVEL_1,
      bvnVerified: update.bvnVerified,
    };
  }

  async verifyIDCard(
    userId: string,
    identityType: IdentityType,
    idNumber: string,
  ) {
    // Validate ID number is provided and has correct format
    if (!idNumber?.trim()) {
      throw new BadRequestException('ID number is required');
    }
    this.validateIdNumber(identityType, idNumber);

    // Fetch user first (needed for all subsequent checks)
    const user = await this.usersService.getOne({ id: userId });
    if (!user) { 
      throw new NotFoundException('User not found');
    }

    // Check if BVN verification is completed (required for ID verification)
    if (user.bvnVerified !== DocumentVerificationStatus.PASSED) {
      throw new BadRequestException(
        'BVN verification is required before ID verification. Please verify your BVN first.',
      );
    }

    // Check if ID already verified
    if (user.identityVerificationStatus === DocumentVerificationStatus.PASSED) {
      return {
        message: 'ID already verified',
        kycLevel: user.kycLevel,
        idVerified: true,
      };
    }

    // Check if ID number is already used by another user
    const isIdExisting = await this.usersService.getOne({
      identityTypeNo: idNumber,
    });
    if (isIdExisting) {
      throw new BadRequestException(
        'ID Number already registered to another account',
      );
    }

    // Call verification service
    const result = await this.verificationService.verifyIdentity(
      identityType,
      idNumber,
    );

    if (result.status !== 'successful') {
      throw new BadRequestException('ID verification failed');
    }

    // Update user with verification details
    const update = await this.prisma.user.update({
      where: { id: userId },
      data: {
        identityType,
        identityTypeNo: idNumber,
        identityVerificationStatus: DocumentVerificationStatus.PASSED,
        kycLevel: KycLevel.LEVEL_2,
        gender: this.mapGenderToEnum(result.data.gender),
        dob: result.data.date_of_birth
          ? new Date(result.data.date_of_birth)
          : null,
      },
    });

    return {
      message: `${identityType} verified successfully`,
      kycLevel: KycLevel.LEVEL_2,
      idVerified: update.identityVerificationStatus,
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
}
