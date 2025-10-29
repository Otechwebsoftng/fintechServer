import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber } from "class-validator";

export class ActivateAccountDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsNumber()
    readonly otp: number

}

