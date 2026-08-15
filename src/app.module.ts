import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from './mail/mail.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { RoleModule } from './role/role.module';
import { PermissionModule } from './permission/permission.module';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './helpers/globalExceptionFilter';
import { MenuModule } from './menu/menu.module';
import { AdminModule } from './admin/admin.module';
import { KycModule } from './kyc/kyc.module';
import { WalletModule } from './wallet/wallet.module';
import { BeneficiaryModule } from './beneficiary/beneficiary.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PaymentModule } from './payment/payment.module';
import { TransactionChargeModule } from './transaction-charge/transaction-charge.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env`,
      isGlobal: true,
    }),
    AuthModule,
    MailModule,
    UsersModule,
    PrismaModule,
    RoleModule,
    PermissionModule,
    MenuModule,
    AdminModule,
    KycModule,
    WalletModule,
    // VirtualCardsModule,
    BeneficiaryModule,
    WebhooksModule,
    PaymentModule,
    TransactionChargeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
