import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TagDto {
  @ApiProperty({ description: 'destination account number' })
  @IsNotEmpty()
  @IsString()
  readonly tag: string;
}
