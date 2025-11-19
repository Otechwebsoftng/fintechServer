import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CreateAdminDto } from './dto/createAdmin.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { PermissionsGuard } from 'src/auth/guard/permission.guard';
import { Permissions } from 'src/auth/decorators/permission.decorator';
import { UpdateAdminRoleDto } from './dto/updateAdminRole.dto';

// @AuditLog({ model: 'user' })
@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({
    description: 'Fetch all active onboarded , with optional status filter',
    summary:
      'Admins such as human resource, super admin can fetch all active onboarded Admins, optionally filtered by status',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Number of users to return per page',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search for users by firstName, lastName, or email',
  })
  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('admin.view_all')
  async getAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
  ) {
    return await this.adminService.getAll(page, pageSize, search);
  }

  @Get('trashed-admins')
  @ApiOperation({
    description: 'Fetch all soft deleted admins',
    summary:
      'Admins such as human resource, super admin can fetch all soft deleted Admins, optionally filtered by status',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Number of users to return per page',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search for users by firstName, lastName, or email',
  })
  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('admin.view_all')
  async getAllTrashed(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
  ) {
    return await this.adminService.getAllTrashedAdmins(page, pageSize, search);
  }

  @Get('/dashboard')
  @ApiOperation({
    description: 'Dashboard statistics',
    summary:
      'Admins such as human resource, super admin can fetch all active onboarded Admins, optionally filtered by status',
  })
  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('admin.view_all')
  async dashboard(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return await this.adminService.dashboardStats();
  }

  @Get(':adminId')
  @ApiOperation({
    description: 'View an Admin by Id',
    summary:
      'Admins such as human resource, super admin can view an admin by Id',
  })
  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('admin.view')
  async viewOne(@Param('adminId') adminId: string) {
    return await this.adminService.viewOne(adminId);
  }

  @Post()
  @ApiOperation({
    description: ' Onboard a new Admin',
    summary: 'Only a super admin can onboard an admin',
  })
  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('admin.create')
  async create(@Body() payload: CreateAdminDto, @CurrentUser() user: User) {
    const userId = user.id;
    return await this.adminService.create(userId, payload);
  }

  @Put(':userId/update-role')
  @ApiOperation({
    description: ' Update an Admin role',
    summary: 'Only a super admin can can update an admin role admin',
  })
  @ApiParam({
    name: 'userId',
    required: true,
    description: 'Id of the admin role to be changed',
  })
  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('role.update')
  async update(
    @Param('userId') userId: string,
    @Body() payload: UpdateAdminRoleDto,
    @CurrentUser() user: User,
  ) {
    const adminId = user.id;
    return await this.adminService.updateAdminROle(adminId, userId, payload);
  }

  @Patch(':userId/soft-delete')
  @ApiOperation({
    description: ' Soft delete an Admin',
    summary:
      'Only a super admin , human resource admins can soft delete an admin ',
  })
  @ApiParam({
    name: 'userId',
    required: true,
    description: 'Id of the admin role to be soft deleted',
  })
  @UseGuards(AuthGuard(), RolesGuard)
  @Permissions('admin.soft_delete')
  async softDelete(@Param('userId') userId: string, @CurrentUser() user: User) {
    const adminId = user.id;
    return await this.adminService.softDelete(adminId, userId);
  }

  @Patch(':userId/restore')
  @ApiOperation({
    description: ' Restore a suspended admin ',
    summary:
      'Only a super admin , human resource admins can soft delete an admin ',
  })
  @ApiParam({
    name: 'userId',
    required: true,
    description: 'Id of the admin role to be restored',
  })
  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('super_admin.full_access', 'admin.soft_delete')
  async restore(@Param('userId') userId: string, @CurrentUser() user: User) {
    const adminId = user.id;
    return await this.adminService.restore(adminId, userId);
  }

  @Patch(':userId/suspend')
  @ApiOperation({
    description: ' delete a suspended admin ',
    summary: 'Only a super admin can permanently delete an admin ',
  })
  @ApiParam({
    name: 'userId',
    required: true,
    description: 'Id of the admin to be deleted',
  })
  @UseGuards(AuthGuard(), PermissionsGuard)
  @Permissions('super_admin.full_access', 'admin.soft_delete')
  async delete(@Param('userId') userId: string, @CurrentUser() user: User) {
    const adminId = user.id;
    return await this.adminService.softDelete(adminId, userId);
  }
}
