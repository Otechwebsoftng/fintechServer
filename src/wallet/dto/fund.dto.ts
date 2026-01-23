import { ApiProperty } from '@nestjs/swagger';
import { Currency, PaymentMethod } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';

export class FundWalletDto {
  @ApiProperty({ description: 'User Id for which the payment is for' })
  @IsOptional()
  @IsString()
  readonly userId?: string;

  @ApiProperty({ description: 'Currency for which payment was made' })
  @IsEnum(Currency)
  readonly currency: Currency;

  @ApiProperty({ description: 'Optional description for the transaction' })
  @IsOptional()
  @IsString()
  readonly description?: string;

  @ApiProperty({ description: 'Optional reference for the transaction' })
  @IsOptional()
  @IsString()
  readonly reference?: string;

  @ApiProperty({ description: 'amount to fund the wallet' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @Max(10000000, { message: 'Amount exceeds maximum limit' })
  readonly amount: number;

  @ApiProperty({
    description:
      'Payment method used to fund the wallet e.g CARD or BANK_TRANSFER',
  })
  @IsEnum(PaymentMethod)
  readonly paymentMethod: PaymentMethod;
}
