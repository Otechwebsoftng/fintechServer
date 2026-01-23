import { forwardRef, Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
import { CustomLogger } from 'src/custom.logger';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    PassportModule,
    PrismaModule,
    MailModule,
    forwardRef(() => UsersModule),
  ],
  providers: [WalletService, CustomLogger,],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
