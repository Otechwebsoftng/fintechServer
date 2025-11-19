import { Injectable, NotFoundException } from '@nestjs/common';
import { PermissionService } from 'src/permission/permission.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { connect } from 'http2';
import { Utility } from 'src/helpers/utilities.service';
import { CreateRoleDto } from './dto/createRole.dto';

@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
    private permissionService: PermissionService,
  ) {}
  async getAll() {
    return await this.prisma.role.findMany({
      where: {
        isDeleted: false,
      },
      include: {
        permissions: {
          include: {
            permission: {
              select: {
                id: true,
                slug: true,
              },
            },
          },
        },
      },
    });
  }

  async getOne(criteria: any) {
    return this.prisma.role.findFirst({
      where: { ...criteria },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async create(payload: CreateRoleDto) {
    const { name, description, permissionIds } = payload;

    const slug = Utility.slugify(name);

    const existingPermissions = await this.prisma.permission.findMany({
      where: {
        id: {
          in: permissionIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingPermissions.length !== permissionIds.length) {
      const foundIds = new Set(existingPermissions.map((p) => p.id));
      const notFoundIds = permissionIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Permissions with IDs ${notFoundIds.join(', ')} not found!`,
      );
    }

    const permissionConnectData = permissionIds.map((permissionId) => ({
      permission: {
        connect: {
          id: permissionId,
        },
      },
    }));

    return this.prisma.role.create({
      data: {
        name: name.toUpperCase(),
        slug,
        description,
        permissions: {
          create: permissionConnectData,
        },
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async viewOne(slug: string) {
    const role = await this.getOne({ slug, isDeleted: false });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async updateRole(roleId: string, payload: CreateRoleDto) {
    const role = await this.getOne({ id: roleId });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    const { name, description, permissionIds } = payload;

    const slug = Utility.slugify(name);

    const existingPermissions = await this.prisma.permission.findMany({
      where: {
        id: {
          in: permissionIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingPermissions.length !== permissionIds.length) {
      const foundIds = new Set(existingPermissions.map((p) => p.id));
      const notFoundIds = permissionIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Permissions with IDs ${notFoundIds.join(', ')} not found!`,
      );
    }

    const permissionConnectData = permissionIds.map((permissionId) => ({
      permission: {
        connect: {
          id: permissionId,
        },
      },
    }));

    return this.prisma.role.update({
      where: { id: roleId },
      data: {
        name: name.toUpperCase(),
        slug,
        description,
        permissions: {
          deleteMany: {
            roleId: roleId,
          },
          create: permissionConnectData,
        },
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async deleteRole(roleId: string) {
    const role = await this.getOne({ id: roleId });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    await this.prisma.role.delete({
      where: { id: roleId },
    });

    return { message: 'Role deleted successfully.' };
  }
}
