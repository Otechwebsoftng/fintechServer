import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UserTagDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly userTag: string;
}
