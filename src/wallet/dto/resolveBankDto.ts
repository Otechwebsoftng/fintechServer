import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class ResolveBankDto {
  @ApiProperty({ description: 'destination account number' })
  @IsNotEmpty()
  @IsString()
  readonly accountNumber: string;

  @ApiProperty({ description: 'Bank code' })
  @IsNotEmpty()
  @IsString()
  readonly bankCode: string;

  @ApiProperty({ description: 'Currency' })
  @IsNotEmpty()
  @IsEnum(Currency)
  readonly currency: Currency;
}
