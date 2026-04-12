import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IdentityType } from '@prisma/client';

export class IdentityVerificationDto {
  @ApiProperty({
    enum: IdentityType,
    description:
      'For Tier 1 make use of NIN and Driver License, Tier 2 make use of International Passport',
  })
  @IsNotEmpty()
  @IsEnum(IdentityType)
  readonly identityType: IdentityType;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly identityTypeNo: string;
}
