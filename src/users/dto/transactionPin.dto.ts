import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  Max,
  MinLength,
} from 'class-validator';

export class TransactionPinDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Transaction pin must be at least 4 digits' })
  @IsNumber()
  transactionPin: number;
}
