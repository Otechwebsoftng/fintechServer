import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsNotEmpty()
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  readonly email: string;

  @ApiProperty({ example: 'fhgtytye@r4d12' })
  @IsNotEmpty()
  @IsString()
  @Length(8)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  readonly password: string;
}
