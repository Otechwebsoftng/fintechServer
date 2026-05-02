import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
export class BeneficiaryAddress {
  @ApiProperty({ description: 'House No' })
  @IsNotEmpty()
  @IsString()
  readonly line1: string;

  @ApiProperty({ description: 'City' })
  @IsNotEmpty()
  @IsString()
  readonly city: string;

  @ApiProperty({ description: 'State' })
  @IsNotEmpty()
  @IsString()
  readonly state: string;

  @ApiProperty({ description: 'Country' })
  @IsNotEmpty()
  @IsString()
  readonly country: string;

  @ApiProperty({ description: 'Postal Code' })
  @IsNotEmpty()
  @IsString()
  readonly zipCode: string;
}

export class SwiftPayoutDto {
  @ApiProperty({
    description: 'destination account number. Not required for tags',
  })
  @IsOptional()
  @IsString()
  readonly accountNumber: string;

  @ApiProperty({
    description: 'Routing number',
  })
  @IsOptional()
  @IsString()
  readonly routingNumber: string;

  @ApiProperty({
    description: 'Routing number',
  })
  @IsOptional()
  @IsString()
  readonly bankName: string;

  @ApiProperty({
    description: 'Beneficiary name For nip transfer',
  })
  @IsNotEmpty()
  @IsString()
  beneficiaryName: string;

  @ApiProperty({
    description: 'Beneficiary physical address details',
    type: BeneficiaryAddress,
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BeneficiaryAddress)
  readonly beneficiaryAddress: BeneficiaryAddress;

  @ApiProperty({
    description: 'Beneficiary physical Bank address details',
    type: BeneficiaryAddress,
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BeneficiaryAddress)
  readonly bankAddress: BeneficiaryAddress;

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
