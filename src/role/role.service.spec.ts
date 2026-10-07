import { Test, TestingModule } from '@nestjs/testing';
import { PermissionService } from 'src/permission/permission.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RoleService } from './role.service';

describe('RoleService', () => {
  let service: RoleService;
  let prisma: {
    role: { findFirst: jest.Mock; delete: jest.Mock };
    rolePermission: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      role: {
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      rolePermission: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(async (operations) => {
        if (typeof operations === 'function') {
          return operations(prisma);
        }
        return Promise.all(operations);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        { provide: PrismaService, useValue: prisma },
        { provide: PermissionService, useValue: {} },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should delete related role permissions before deleting a role', async () => {
    const roleId = 'role-123';
    prisma.role.findFirst.mockResolvedValue({ id: roleId });
    prisma.rolePermission.deleteMany.mockResolvedValue({ count: 1 });
    prisma.role.delete.mockResolvedValue({ id: roleId });

    await service.deleteRole(roleId);

    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { roleId },
    });
    expect(prisma.role.delete).toHaveBeenCalledWith({
      where: { id: roleId },
    });
  });
});
