import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class PayoutDestinationDto {
  @ApiProperty({ description: 'destination account number' })
  @IsNotEmpty()
  @IsString()
  readonly accountNumber: string;

  @ApiProperty({ description: 'Default selected currency' })
  @IsNotEmpty()
  @IsEnum(Currency)
  readonly currency: Currency;

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
