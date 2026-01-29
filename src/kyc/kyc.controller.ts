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
  @Post('/verify-bvn')
  @UseGuards(AuthGuard())
  async verifyBvn(@Body() payload: { bvn: string }, @CurrentUser() user: User) {
    const userId = user.id;
    const { bvn } = payload;
    return this.kycService.verifyBvn(userId, bvn);
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
      limits: { fileSize: 5 * 1024 * 1024 },
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
    @Body() payload: { identityType: IdentityType; identityNumber: string },
    @CurrentUser() user: User,
  ) {
    const userId = user.id;
    const { identityType, identityNumber } = payload;
    return this.kycService.verifyIDCard(
      userId,
      identityType,
      identityNumber,
      file,
    );
  }

}
