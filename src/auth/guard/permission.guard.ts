import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma/prisma.service'; // Assuming your PrismaService path
import { User as PrismaUser, User } from '@prisma/client'; // Import Prisma's generated User type

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService, // Inject PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    // If no specific permissions are required for this route, allow access
    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const user = request.user as User;

    if (!user || !user.id || !user.roleId) {
      throw new ForbiddenException(
        'Authentication required or user has no assigned role.',
      );
    }

    const userWithRoleAndPermissions = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        role: {
          select: {
            permissions: {
              select: {
                permission: {
                  // Access the actual Permission object
                  select: {
                    slug: true, // Only need the slug for comparison
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userWithRoleAndPermissions || !userWithRoleAndPermissions.role) {
      throw new ForbiddenException('User role not found or invalid.');
    }

    // Extract the slugs of all permissions associated with the user's role
    const userPermissionSlugs = userWithRoleAndPermissions.role.permissions.map(
      (rp) => rp.permission.slug, // Access the slug from the nested 'permission' object
    );

    // If the user's role has the 'super_admin.full_access' permission,
    // they are allowed access to ANY route, regardless of other 'requiredPermissions'.
    const isSuperAdmin = userPermissionSlugs.includes(
      'super_admin.full_access',
    );
    if (isSuperAdmin) {
      return true; // Super admin always allowed!
    }

    // Check if the user has *any* of the required permissions for the route
    const hasPermission = requiredPermissions.some((permission) =>
      userPermissionSlugs.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have the necessary permissions to access this resource.',
      );
    }

    return true;
  }
}
