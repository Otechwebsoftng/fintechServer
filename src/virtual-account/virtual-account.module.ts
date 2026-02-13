import { Module } from '@nestjs/common';
import { VirtualAccountController } from './virtual-account.controller';
import { VirtualAccountService } from './virtual-account.service';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
import { CustomLogger } from 'src/custom.logger';

@Module({
  imports: [AuthModule, UsersModule, PrismaModule, MailModule],
  controllers: [VirtualAccountController],
  providers: [VirtualAccountService, CustomLogger],
})
export class VirtualAccountModule {}
