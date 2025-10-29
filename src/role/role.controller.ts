import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RoleService } from './role.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from 'src/auth/guard/permission.guard';
import { Permissions } from 'src/auth/decorators/permission.decorator';

@ApiTags('Role Management')
@Controller('role')
export class RoleController {
  constructor(private roleService: RoleService) {}

  @Get()
  @ApiOperation({
    description:
      'Fetch all roles. Admins such as human resource, super admin can fetch all active onboarded Admins, optionally filtered by status',
    summary: 'Fetch all roles',
  })
  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('super_admin.full_access', 'support_admin')
  async getAll() {
    return await this.roleService.getAll();
  }

  @Get(':slug')
  @ApiOperation({
    description:
      'Fetch a specific role by slug. Admins such as human resource, super admin can',
    summary: 'Fetch a specific role by slug',
  })
  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('super_admin.full_access', 'support_admin.view')
  async getOne(@Param('slug') slug: string) {
    return await this.roleService.viewOne(slug);
  }
}
