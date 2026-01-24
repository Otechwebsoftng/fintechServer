import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    UseGuards,
} from '@nestjs/common';
// import { AuditLog } from 'src/audit-log/audit-log.decorator';
import { RoleService } from './role.service';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from 'src/auth/guard/permission.guard';
import { Permissions } from 'src/auth/decorators/permission.decorator'

import { CreateRoleDto } from './dto/createRole.dto';
import { UpdateRoleDto } from './dto/updateRole.dto';

// @AuditLog({ model: 'role' })
@ApiTags('Role')
@ApiBearerAuth('JWT-auth')
@Controller('role')
export class RoleController {
    constructor(private readonly roleService: RoleService) {}

    @Get()
    @ApiOperation({
        description: 'Fetch Roles',
        summary:
            'Admins such as super admin can fetch all active onboarded Admins, optionally filtered by status',
    })
    @UseGuards(AuthGuard(), PermissionsGuard)
    @Permissions('role.view_all', 'hr.manage_employees')
    async getAll() {
        return await this.roleService.getAll();
    }

    @Get(':roleId')
    @ApiOperation({
        description: 'Fetch a single role',
        summary:
            'Admins such as super admin can fetch all active onboarded Admins',
    })
    @UseGuards(AuthGuard(), PermissionsGuard)
    @Permissions('role.view_all')
    async viewOne(@Param('roleId') roleId: string) {
        return await this.roleService.viewOne(roleId);
    }

    @Post()
    @ApiOperation({
        description: 'Create a role',
        summary: 'Admins such as super admin can create an admin role',
    })
    @UseGuards(AuthGuard(), PermissionsGuard)
    @Permissions('role.create')
    async create(@Body() payload: CreateRoleDto) {
        return await this.roleService.create(payload);
    }

    @Put(':roleId')
    @ApiOperation({
        description: 'Update a role',
        summary: 'Admins such as super admin can update an admin role',
    })
    @UseGuards(AuthGuard(), PermissionsGuard)
    @Permissions('role.update')
    async update(
        @Param('roleId') roleId: string,
        @Body() payload: UpdateRoleDto
    ) {
        return await this.roleService.updateRole(roleId, payload);
    }

    @Delete(':roleId')
    @ApiOperation({
        description: 'Delete a role',
        summary: 'Admins such as super admin can Delete an admin role',
    })
    @UseGuards(AuthGuard(), PermissionsGuard)
    @Permissions('role.soft_delete')
    async delete(@Param('roleId') roleId: string) {
        return await this.roleService.deleteRole(roleId);
    }
}
