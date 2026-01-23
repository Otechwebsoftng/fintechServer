import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateBeneficiaryOtpDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly country: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly bankName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  readonly accountNumber: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly accountName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly bankCode: string;
}
