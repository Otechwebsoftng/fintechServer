import { forwardRef, Module } from '@nestjs/common';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { CustomLogger } from 'src/custom.logger';
import { FincraVerificationService } from 'src/vendors/fincra.verification-service';
import { DojahVerificationService } from 'src/vendors/dojah.verification';
import { GraphService } from 'src/vendors/graph.service';
import { WalletModule } from 'src/wallet/wallet.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    PassportModule,
    UsersModule,
    WalletModule,
  ],
  providers: [
    KycService,
    CustomLogger,
    FincraVerificationService,
    DojahVerificationService,
    GraphService,
    CustomLogger,
  ],
  controllers: [KycController],
})
export class KycModule {}
