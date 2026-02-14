import { ApiProperty } from '@nestjs/swagger';
import { UserType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
    IsEmail,
    IsNotEmpty,
} from 'class-validator';

export class SendPasswordOtpDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsEmail({}, { message: 'Please enter correct email address' })
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
      )
    readonly email: string; 
}
