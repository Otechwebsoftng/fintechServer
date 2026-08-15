import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Utility } from 'src/helpers/utilities.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { CreateMenuDto } from './dto/createMenu.dto';

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async getUserMenu(userId: string) {
    const userRole = await this.usersService.getOne({
      where: { id: userId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
            permissions: {
              select: {
                permissionId: true,
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!userRole || !userRole.role) {
      return [];
    }

    const userPermissions = userRole.role.permissions.map(
      (p) => p.permissionId,
    );

    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        permissions: {
          some: {
            permissionId: {
              in: userPermissions,
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        url: true,
        icon: true,
        order: true,
        parentId: true,
        permissions: true,
      },
      orderBy: { order: 'asc' },
    });

    return this.buildMenuTree(menuItems);
  }

  async getOne(criteria: any) {
    return await this.prisma.menuItem.findUnique({
      where: {
        ...criteria,
      },
    });
  }

  async createParentMenu(payload: CreateMenuDto) {
    const formattedName =
      payload.name.charAt(0).toUpperCase() +
      payload.name.slice(1).toLowerCase();

    const slug = Utility.slugify(formattedName);

    const existingMenu = await this.getOne({ slug });
    if (existingMenu) {
      throw new ConflictException(
        `Menu with name '${formattedName}' already exists.`,
      );
    }

    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: payload.permissions } },
    });

    if (permissions.length !== payload.permissions.length) {
      throw new NotFoundException(
        'One or more provided permissions do not exist.',
      );
    }

    const newMenu = await this.prisma.menuItem.create({
      data: {
        name: formattedName,
        slug,
        url: payload.url,
        icon: payload.icon,
        order: payload.order,
        permissions: {
          create: payload.permissions.map((permissionId) => ({
            permissionId: permissionId,
          })),
        },
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

    return newMenu;
  }

  async createChildMenu(parentId: string, payload: CreateMenuDto) {
    const validMenu = await this.getOne({ id: parentId });

    if (!validMenu) {
      throw new NotFoundException('Menu not found!');
    }

    const formattedName =
      payload.name.charAt(0).toUpperCase() +
      payload.name.slice(1).toLowerCase();

    const slug = Utility.slugify(formattedName);

    const existingMenu = await this.getOne({ slug });
    if (existingMenu) {
      throw new ConflictException(
        `Menu with name '${formattedName}' already exists.`,
      );
    }

    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: payload.permissions } },
    });

    if (permissions.length !== payload.permissions.length) {
      throw new NotFoundException(
        'One or more provided permissions do not exist.',
      );
    }

    const newMenu = await this.prisma.menuItem.create({
      data: {
        name: formattedName,
        slug,
        url: payload.url,
        icon: payload.icon,
        order: payload.order,
        parentId: parentId,
        permissions: {
          create: payload.permissions.map((permissionId) => ({
            permissionId: permissionId,
          })),
        },
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

    return newMenu;
  }

  private buildMenuTree(items, parentId: string | null = null) {
    return items
      .filter((item) => item.parentId === parentId)
      .map((item) => ({
        ...item,
        children: this.buildMenuTree(items, item.id),
      }));
  }
}
