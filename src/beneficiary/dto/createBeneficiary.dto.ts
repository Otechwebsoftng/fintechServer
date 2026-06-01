import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateBeneficiaryDto {
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
  @IsString()
  readonly accountNumber: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly accountName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly bankCode: string;
}
