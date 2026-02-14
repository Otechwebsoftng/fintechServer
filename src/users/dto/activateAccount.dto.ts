import { ApiProperty } from '@nestjs/swagger';
import { OtpType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ActivateAccountDto {
  @ApiProperty({ enum: OtpType })
  @IsEnum(OtpType)
  readonly otpType: OtpType;

  @ApiProperty({ description: 'OTP code sent to the user', example: '123456' })
  @IsNotEmpty()
  @IsString()
  readonly otp: string;
}
