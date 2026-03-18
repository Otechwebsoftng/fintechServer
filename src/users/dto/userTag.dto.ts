import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UserTagDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly userTag: string;
}
