import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PaymentService {
  constructor(readonly prisma: PrismaService) {}

  async getOne(criteria: any) {
    return await this.prisma.payment.findFirst({
      where: criteria,
    });
  }
}
