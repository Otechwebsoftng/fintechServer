import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from 'src/auth/guard/permission.guard';
import { Permissions } from 'src/auth/decorators/permission.decorator';

// @AuditLog({ model: 'user' })
@ApiTags('Permissions')
@ApiBearerAuth('JWT-auth')
@Controller('permission')
export class PermissionController {
  constructor(private permissionService: PermissionService) {}

  @Get()
  @ApiOperation({
    description:
      'Fetch all permissions. Admins such as human resource, super admin can fetch all active onboarded Admins, optionally filtered by status',
    summary: 'Fetch all permissions',
  })
  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('super_admin.full_access')
  async getAll() {
    return await this.permissionService.getAll();
  }

  @Get('slug')
  @ApiOperation({
    description:
      'Fetch a specific permission by slug. Admins such as human resource, super admin can',
    summary: 'Fetch a specific permission by slug',
  })
  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('super_admin.full_access')
  async getOne(@Param('slug') slug: string) {
    return await this.permissionService.viewOne(slug);
  }
}
