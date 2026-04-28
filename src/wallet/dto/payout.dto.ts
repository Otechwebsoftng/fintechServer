import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
} from 'class-validator';

export class PayoutDestinationDto {
  @ApiProperty({ description: 'Used only for tag transfer' })
  @IsOptional()
  @IsString()
  readonly tag: string;

  @ApiProperty({
    description: 'destination account number. Not required for tags',
  })
  @IsOptional()
  @IsString()
  readonly accountNumber: string;

  @ApiProperty({ description: 'Currency to transfer from' })
  @IsOptional()
  @IsEnum(Currency)
  readonly currencyFrom: Currency;

  @ApiProperty({ description: 'Currency to transfer to' })
  @IsNotEmpty()
  @IsEnum(Currency)
  readonly currencyTo: Currency;

  @ApiProperty({ description: 'payout amount' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  readonly amount: number;

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
