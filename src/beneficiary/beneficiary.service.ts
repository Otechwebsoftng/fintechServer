import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { CreateBeneficiaryOtpDto } from './dto/create.dto';

@Injectable()
export class BeneficiaryService {
  constructor(
    readonly prisma: PrismaService,
    readonly usersService: UsersService,
  ) {}

  //   async createBeneficiary(userId: string, payload: CreateBeneficiaryOtpDto) {
  //     const user = await this.usersService.getOne({ id: userId });
  //     if (!user) {
  //       throw new Error('User not found');
  //     }

  //     // const beneficiary = await this.prisma.beneficiary.create({
  //     //   data: {
  //     //     userId: user.id,
  //     //     country: payload.country,
  //     //     bankName: payload.bankName,
  //     //     accountNumber: payload.accountNumber,
  //     //     accountName: payload.accountName,
  //     //     bankCode: payload.bankCode,
  //     //   },
  //     // });
  //   }
}
