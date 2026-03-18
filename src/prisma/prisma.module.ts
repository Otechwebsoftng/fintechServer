import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CustomLogger } from 'src/custom.logger';

@Global()
@Module({
  providers: [PrismaService, CustomLogger],
  exports: [PrismaService],
})
export class PrismaModule {}
