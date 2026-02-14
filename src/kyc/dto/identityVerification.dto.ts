import { IsDate, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IdentityType } from '@prisma/client';

export class IdentityVerificationDto {
  @ApiProperty({ enum: IdentityType })
  @IsNotEmpty()
  @IsEnum(IdentityType)
  readonly identityType: IdentityType;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly issuedCountry: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly identityTypeNo: string;

  @ApiProperty({ example: '2020-01-15' })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  readonly issuedDate: Date;

  @ApiProperty({ example: '2030-01-15' })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  readonly expiryDate: Date;
}
