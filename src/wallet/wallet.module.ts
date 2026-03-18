import { forwardRef, Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from 'src/mail/mail.module';
import { CustomLogger } from 'src/custom.logger';
import { UsersModule } from 'src/users/users.module';
import { GraphService } from 'src/vendors/graph.service';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    PassportModule,
    MailModule,
    forwardRef(() => UsersModule),
  ],
  providers: [WalletService, CustomLogger, GraphService],
  controllers: [WalletController],
  exports: [WalletService, CustomLogger, GraphService],
})
export class WalletModule {}
