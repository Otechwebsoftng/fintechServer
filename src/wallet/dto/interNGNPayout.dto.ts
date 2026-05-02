import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '@prisma/client';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsEnum,
} from 'class-validator';

export class InterNGNPayoutDto {
  @ApiProperty({
    description: 'destination account number. Not required for tags',
  })
  @IsOptional()
  @IsString()
  readonly accountNumber: string;

  @ApiProperty({ description: 'Bank Code' })
  @IsOptional()
  @IsString()
  readonly bankCode: string;

  @ApiProperty({ description: 'Beneficiary name' })
  @IsOptional()
  @IsString()
  beneficiary: string;

  @ApiProperty({ description: 'payout amount' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  readonly amount: number;

  @ApiProperty({ description: 'Senders Currency' })
  @IsNotEmpty()
  @IsEnum(Currency)
  readonly currencyFrom: Currency;

  @ApiProperty({ description: 'Beneficiary Currency' })
  @IsNotEmpty()
  @IsEnum(Currency)
  readonly currencyTo: Currency;

  @ApiProperty({ description: 'Payment Description' })
  @IsOptional()
  @IsString()
  readonly description: string;

  @ApiProperty({ description: 'Payment Reference from client' })
  @IsNotEmpty()
  @IsString()
  readonly reference: string;

  @ApiProperty({ description: 'Transaction PIN for verification' })
  @IsNotEmpty()
  @IsString()
  readonly transactionPin: string;
}
