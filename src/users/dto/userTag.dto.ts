import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UserTageDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly userTag: string;
}
