import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { KycService } from './kyc.service';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { IdentityType, User } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { BvnDto } from './dto/bvn.dto';
import { TaxAddressDto } from './dto/taxAddress.dto';
import { IdentityVerificationDto } from './dto/identityVerification.dto';
import { UtilityVerificationDto } from './dto/utility.dto';

@ApiTags('Kyc Verification')
@ApiBearerAuth('JWT-auth')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @ApiOperation({
    description: 'Check KYC Status',
    summary: 'Check the KYC status of a currently logged in user ',
  })
  @Get('/status')
  @UseGuards(AuthGuard())
  @UseInterceptors(UseInterceptors)
  async checkKycStatus(@CurrentUser() user: User) {
    const userId = user.id;
    return this.kycService.checkUserKycStatus(userId);
  }

  @ApiOperation({
    description: 'Verify user Bvn',
    summary: 'Verify user Bvn with external service provider',
  })
  @Post('verify-bvn')
  @UseGuards(AuthGuard())
  async verifyBvn(@Body() payload: BvnDto, @CurrentUser() user: User) {
    const userId = user.id;
    return this.kycService.verifyBvn(userId, payload);
  }

  @ApiOperation({
    description: 'Update user tax address',
    summary: 'Update user tax address information',
  })
  @Patch('update-tax-address')
  @UseGuards(AuthGuard())
  async updateTaxAddress(
    @Body() payload: TaxAddressDto,
    @CurrentUser() user: User,
  ) {
    return this.kycService.updateTaxAddress(user, payload);
  }

  @ApiOperation({
    description: 'Verify user Identity Document',
    summary:
      'Verify user Identity Document such as Driver License, National Identity Number, Passport etc',
  })
  @Post('/verify-identity')
  @UseGuards(AuthGuard())
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Only .jpg and .png files are allowed!'),
            false,
          );
        }
      },
    }),
  )
  async verifyIdentity(
    @UploadedFile() file,
    @Body() payload: IdentityVerificationDto,
    @CurrentUser() user: User,
  ) {
    const userId = user.id;
    return this.kycService.verifyIdentityDocument(userId, payload, file);
  }

  @ApiOperation({
    description: 'Verify user Utility Bill',
    summary:
      'Verify user Utility Bill such as electricity, water, or internet bills',
  })
  @Post('/verify-utility')
  @UseGuards(AuthGuard())
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Only .jpg and .png files are allowed!'),
            false,
          );
        }
      },
    }),
  )
  async verifyUtility(
    @UploadedFile() file,
    @Body() payload: UtilityVerificationDto,
    @CurrentUser() user: User,
  ) {
    const userId = user.id;
    return this.kycService.verifyUtility(userId, file, payload);
  }
}
