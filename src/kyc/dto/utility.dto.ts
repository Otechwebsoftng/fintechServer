import { IsDate, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BillType, IdentityType } from '@prisma/client';

export class UtilityVerificationDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsEnum(BillType)
  readonly utilityType: BillType;

}
