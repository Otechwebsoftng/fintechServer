import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CustomLogger } from 'src/custom.logger';

@Module({
  providers: [PrismaService, CustomLogger],
  exports: [PrismaService]

})
export class PrismaModule {}
