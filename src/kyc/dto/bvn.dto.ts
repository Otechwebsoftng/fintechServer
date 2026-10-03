import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IdentityType } from '@prisma/client';

export class ConsentDto {
  @ApiProperty({
    description: 'Must be true; user has granted consent.',
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  readonly granted: boolean;

  @ApiProperty({
    description: 'ISO 8601 timestamp of when the consent was granted.',
    example: '2026-03-06T12:00:00.000Z',
  })
  @IsNotEmpty()
  @IsString()
  readonly granted_at: string;

  @ApiProperty({
    description:
      'ISO 639-1 language code of the privacy notice shown, uppercase.',
    example: 'EN',
  })
  @IsNotEmpty()
  @IsString()
  readonly notice_language: string;

  @ApiProperty({
    description: 'URL of the privacy policy shown to the user.',
    example: 'https://example.com/privacy-policy',
  })
  @IsNotEmpty()
  @IsUrl()
  readonly notice_privacy_policy_url: string;
}

export class BvnDto {
  @ApiProperty({
    enum: IdentityType,
    description:
      'For Tier 1 use NIN or Driver License. For Tier 2 use International Passport.',
  })
  @IsNotEmpty()
  @IsEnum(IdentityType)
  readonly identityType: IdentityType;

  @ApiProperty({
    description: 'The identification document number.',
    example: '12345678901',
  })
  @IsNotEmpty()
  @IsString()
  readonly number: string;

  @ApiProperty({
    type: () => ConsentDto,
    description: 'User consent information for identity verification.',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ConsentDto)
  readonly consent: ConsentDto;
}
