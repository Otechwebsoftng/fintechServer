import { ApiProperty } from '@nestjs/swagger';
import { UserType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @ApiProperty()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  readonly firstName: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  readonly lastName: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  readonly phoneNumber: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please enter correct email address' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  readonly email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  readonly password: string;

  @ApiProperty({ enum: UserType })
  @IsEnum(UserType)
  @IsOptional()
  readonly userType: UserType;
}
