import { Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PermissionModule } from 'src/permission/permission.module';

@Module({
  imports: [AuthModule, PermissionModule],
  providers: [RoleService],
  controllers: [RoleController],
  exports: [RoleService],
})
export class RoleModule {}
