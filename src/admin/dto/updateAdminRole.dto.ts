import { ApiProperty } from '@nestjs/swagger';
import { Role, UserType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
    IsEmail,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    MinLength,
} from 'class-validator';

export class UpdateAdminRoleDto {

    @ApiProperty({ type: 'Role Id' })
    @IsString()
    @IsOptional()
    readonly roleId: string;
}
