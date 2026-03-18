import { Module } from '@nestjs/common';
import { VirtualAccountController } from './virtual-account.controller';
import { VirtualAccountService } from './virtual-account.service';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { MailModule } from 'src/mail/mail.module';
import { CustomLogger } from 'src/custom.logger';
import { FincraVerificationService } from 'src/vendors/fincra.verification-service';
import { WalletModule } from 'src/wallet/wallet.module';
import { GraphService } from 'src/vendors/graph.service';

@Module({
  imports: [AuthModule, UsersModule, WalletModule, MailModule],
  controllers: [VirtualAccountController],
  providers: [
    VirtualAccountService,
    CustomLogger,
    FincraVerificationService,
    GraphService,
  ],
  exports: [VirtualAccountService, FincraVerificationService, GraphService],
})
export class VirtualAccountModule {}
