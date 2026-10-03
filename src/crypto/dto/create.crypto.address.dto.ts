import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CryptoCurrency } from '@prisma/client';

export class CreateCryptoAddressDto {
  @ApiProperty()
  @IsEnum(CryptoCurrency)
  readonly currency!: CryptoCurrency;

  @ApiProperty()
  @IsString()
  readonly network!: string;

  @ApiProperty()
  @IsString()
  readonly uniqueUserIdentifier!: string;
}
