import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  BillType,
  EmploymentStatus,
  PrimaryPurposeUSDAccount,
  SourceOfFunds,
} from '@prisma/client';

export class UtilityVerificationDto {
  @ApiProperty({ enum: BillType })
  @IsNotEmpty()
  @IsEnum(BillType)
  readonly utilityType: BillType;

  @ApiProperty({ enum: EmploymentStatus })
  @IsNotEmpty()
  @IsEnum(EmploymentStatus)
  readonly employmentStatus: EmploymentStatus;

  @ApiProperty({ example: 'Software Engineer' })
  @IsNotEmpty()
  @IsString()
  readonly occupation: string;

  @ApiProperty({ enum: PrimaryPurposeUSDAccount })
  @IsNotEmpty()
  @IsEnum(PrimaryPurposeUSDAccount)
  readonly primary_purpose: PrimaryPurposeUSDAccount;

  @ApiProperty({ enum: SourceOfFunds })
  @IsNotEmpty()
  @IsEnum(SourceOfFunds)
  readonly source_of_funds: SourceOfFunds;

  @ApiProperty({ example: 50000 })
  @IsNotEmpty()
  @IsNumber()
  readonly expected_monthly_inflow: number;
}
