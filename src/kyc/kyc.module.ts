import { forwardRef, Module } from '@nestjs/common';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { CustomLogger } from 'src/custom.logger';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    PassportModule,
    UsersModule,
    PrismaModule,
  ],
  providers: [KycService, CustomLogger],
  controllers: [KycController],
})
export class KycModule {}
