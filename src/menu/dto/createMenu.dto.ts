import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateMenuDto {
  @ApiProperty({
    description: 'Menu name',
  })
  @IsNotEmpty()
  @IsString()
  readonly name: string;

  @ApiProperty({
    description: 'Menu url',
  })
  @IsNotEmpty()
  @IsString()
  readonly url: string;

  @ApiProperty({
    description: 'Menu icon name',
  })
  @IsNotEmpty()
  @IsString()
  readonly icon: string;

  @ApiProperty({
    description: 'Menu order',
  })
  @IsNotEmpty()
  @IsNumber()
  readonly order: number;

  @ApiProperty({
    description: 'Menu parent Id',
  })
  @IsOptional()
  @IsString()
  readonly parentId: string;

  @ApiProperty({
    description: 'Menu Permissions',
  })
  @IsNotEmpty()
  @IsArray()
  readonly permissions: string[];
}
