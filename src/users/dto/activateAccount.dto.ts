import { ApiProperty } from '@nestjs/swagger';
import { OtpType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ActivateAccountDto {
  @ApiProperty({ description: 'Type of OTP being used' })
  @IsEnum(OtpType)
  readonly otpType: OtpType;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly otp: string;
}
