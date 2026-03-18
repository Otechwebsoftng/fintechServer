import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BvnDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly number: string;

  // @ApiProperty()
  // @IsNotEmpty()
  // @IsString()
  // readonly business: string;
}
