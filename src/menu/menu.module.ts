import { Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { RoleModule } from 'src/role/role.module';
import { PermissionModule } from 'src/permission/permission.module';
import { CustomLogger } from 'src/custom.logger';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    PrismaModule,
    PassportModule,
    RoleModule,
    PermissionModule,
  ],
  providers: [MenuService, CustomLogger, JwtService],
  controllers: [MenuController],
  exports: [MenuService, CustomLogger, JwtService],
})
export class MenuModule {}
