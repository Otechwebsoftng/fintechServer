import { forwardRef, Module } from '@nestjs/common';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { CustomLogger } from 'src/custom.logger';
import { VerificationService } from 'src/vendors/verification-service';
import { DojahVerificationService } from 'src/vendors/dojah.verification';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    PassportModule,
    UsersModule,
    PrismaModule,
  ],
  providers: [KycService, CustomLogger, VerificationService, DojahVerificationService],
  controllers: [KycController],
})
export class KycModule {}
