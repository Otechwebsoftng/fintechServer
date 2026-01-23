import { Module } from '@nestjs/common';
import { BeneficiaryController } from './beneficiary.controller';
import { BeneficiaryService } from './beneficiary.service';
import { AuthModule } from 'src/auth/auth.module';
import { Prisma } from '@prisma/client';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [AuthModule, PrismaModule, UsersModule],
  controllers: [BeneficiaryController],
  providers: [BeneficiaryService],
  exports: [BeneficiaryService],
})
export class BeneficiaryModule {}
