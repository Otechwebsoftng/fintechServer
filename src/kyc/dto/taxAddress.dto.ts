import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TaxAddressDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  readonly country?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  readonly state?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  readonly city?: string;

  @ApiProperty({})
  @IsOptional()
  @IsString()
  readonly street?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  readonly houseNo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  readonly zipCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  readonly nationality?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  readonly taxCountry?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  readonly taxNumber?: string;
}
