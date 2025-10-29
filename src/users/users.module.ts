import { forwardRef, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthModule } from 'src/auth/auth.module';
import { UsersController } from './users.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { CustomLogger } from 'src/custom.logger';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    PassportModule,
    PrismaModule,
    MailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, JwtService, CustomLogger],
  exports: [UsersService],
})
export class UsersModule {}
