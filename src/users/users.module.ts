import { forwardRef, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthModule } from 'src/auth/auth.module';
import { UsersController } from './users.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { CustomLogger } from 'src/custom.logger';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { AirwallexService } from 'src/vendors/airwallex.service';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    PassportModule,
    PrismaModule,
    MailModule,
    forwardRef(() => WalletModule),

    
  ],
  controllers: [UsersController],
  providers: [UsersService, JwtService, AirwallexService, CustomLogger],
  exports: [UsersService],
})
export class UsersModule {}
