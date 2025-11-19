import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { JwtService } from '@nestjs/jwt';
import { UsersModule } from 'src/users/users.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
import { RoleModule } from 'src/role/role.module';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from 'src/auth/auth.module';
import { CustomLogger } from 'src/custom.logger';

@Module({
  imports: [
    AdminModule,
    AuthModule,
    UsersModule,
    PrismaModule,
    PassportModule,
    MailModule,
    RoleModule,
  ],
  providers: [AdminService, CustomLogger, JwtService],
  controllers: [AdminController],
  exports: [AdminService, CustomLogger, JwtService],
})
export class AdminModule {}
