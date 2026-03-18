import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RoleService } from '../role/role.service';
import { MailService } from '../mail/mail.service';
import { CustomLogger } from '../custom.logger';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { AccountStatus, UserType } from '@prisma/client';

describe('AdminService', () => {
  let service: AdminService;
  let prismaService: any;
  let usersService: any;
  let roleService: any;
  let mailService: any;

  const mockAdmin = {
    id: 'admin-1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    phoneNumber: '+1234567890',
    password: 'hashedPassword',
    transactionPin: null,
    userType: UserType.ADMIN,
    status: AccountStatus.ACTIVE,
    isEmailVerified: true,
    isDeleted: false,
    role: {
      id: 'role-1',
      name: 'Admin',
      permissions: ['admin.view_all'],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRole = {
    id: 'role-1',
    name: 'Admin',
    permissions: ['admin.view_all', 'admin.create'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockUsersService = {
      getOne: jest.fn(),
    };

    const mockRoleService = {
      getOne: jest.fn(),
    };

    const mockMailService = {
      adminWelcome: jest.fn(),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: RoleService, useValue: mockRoleService },
        { provide: MailService, useValue: mockMailService },
        { provide: CustomLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prismaService = module.get(PrismaService);
    usersService = module.get(UsersService);
    roleService = module.get(RoleService);
    mailService = module.get(MailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAll', () => {
    it('should return paginated list of admins without passwords', async () => {
      const admins = [
        mockAdmin,
        {
          ...mockAdmin,
          id: 'admin-2',
          email: 'admin2@example.com',
        },
      ];

      prismaService.user.findMany.mockResolvedValue(admins);
      prismaService.user.count.mockResolvedValue(2);

      const result = await service.getAll(1, 10);

      expect(result.pagination.count).toBe(2);
      expect(result.usersWithoutPassword).toHaveLength(2);
      expect(result.usersWithoutPassword[0]).not.toHaveProperty('password');
      expect(result.usersWithoutPassword[0]).not.toHaveProperty(
        'transactionPin',
      );
    });

    it('should filter admins by search term', async () => {
      prismaService.user.findMany.mockResolvedValue([mockAdmin]);
      prismaService.user.count.mockResolvedValue(1);

      await service.getAll(1, 10, 'admin');

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ firstName: expect.any(Object) }),
              expect.objectContaining({ lastName: expect.any(Object) }),
              expect.objectContaining({ email: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });

    it('should return admins without pagination when not provided', async () => {
      prismaService.user.findMany.mockResolvedValue([mockAdmin]);
      prismaService.user.count.mockResolvedValue(1);

      const result = await service.getAll();

      expect(result.pagination.hasNext).toBeUndefined();
      expect(result.pagination.hasPrevious).toBeUndefined();
      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userType: UserType.ADMIN,
          }),
          skip: undefined,
          take: undefined,
        }),
      );
    });

    it('should include role information in results', async () => {
      prismaService.user.findMany.mockResolvedValue([mockAdmin]);
      prismaService.user.count.mockResolvedValue(1);

      const result = await service.getAll(1, 10);

      expect(result.usersWithoutPassword[0]).toHaveProperty('role');
      expect(result.usersWithoutPassword[0].role).toHaveProperty('name');
    });
  });

  describe('getAllTrashedAdmins', () => {
    it('should return paginated list of soft deleted admins', async () => {
      const deletedAdmin = {
        ...mockAdmin,
        isDeleted: true,
        status: AccountStatus.INACTIVE,
      };

      prismaService.user.findMany.mockResolvedValue([deletedAdmin]);
      prismaService.user.count.mockResolvedValue(1);

      const result = await service.getAllTrashedAdmins(1, 10);

      expect(result.pagination.count).toBe(1);
      expect(result.usersWithoutPassword).toHaveLength(1);
      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userType: UserType.ADMIN,
            isDeleted: true,
            status: AccountStatus.INACTIVE,
          }),
        }),
      );
    });

    it('should filter trashed admins by search term', async () => {
      const deletedAdmin = {
        ...mockAdmin,
        isDeleted: true,
        status: AccountStatus.INACTIVE,
      };

      prismaService.user.findMany.mockResolvedValue([deletedAdmin]);
      prismaService.user.count.mockResolvedValue(1);

      await service.getAllTrashedAdmins(1, 10, 'admin');

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
            isDeleted: true,
          }),
        }),
      );
    });
  });

  describe('viewOne', () => {
    it('should return sanitized admin data', async () => {
      usersService.getOne.mockResolvedValue(mockAdmin);

      const result = await service.viewOne('admin-1');

      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('transactionPin');
      expect(result).toHaveProperty('email');
      expect(usersService.getOne).toHaveBeenCalledWith({
        id: 'admin-1',
        userType: UserType.ADMIN,
      });
    });

    it('should throw NotFoundException when admin not found', async () => {
      usersService.getOne.mockResolvedValue(null);

      await expect(service.viewOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.viewOne('invalid-id')).rejects.toThrow(
        'Admin not found!',
      );
    });
  });

  describe('create', () => {
    const createAdminDto = {
      firstName: 'New',
      lastName: 'Admin',
      email: 'newadmin@example.com',
      roleId: 'role-1',
    };

    it('should create a new admin successfully', async () => {
      usersService.getOne
        .mockResolvedValueOnce(mockAdmin)
        .mockResolvedValueOnce(null);
      roleService.getOne.mockResolvedValue(mockRole);
      prismaService.user.create.mockResolvedValue({
        ...mockAdmin,
        ...createAdminDto,
        id: 'new-admin-1',
      });
      mailService.adminWelcome.mockResolvedValue(undefined);

      const result = await service.create('admin-1', createAdminDto);

      expect(result).toHaveProperty('message', 'Admin created successfully!');
      expect(result).toHaveProperty('admin');
      expect(result.admin).not.toHaveProperty('password');
      expect(mailService.adminWelcome).toHaveBeenCalled();
    });

    it('should throw NotFoundException when creator not found', async () => {
      usersService.getOne.mockResolvedValue(null);

      await expect(
        service.create('invalid-id', createAdminDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.create('invalid-id', createAdminDto),
      ).rejects.toThrow('Creator user not found.');
    });

    it('should throw NotFoundException when role not found', async () => {
      jest.clearAllMocks();
      usersService.getOne.mockResolvedValueOnce(mockAdmin);
      usersService.getOne.mockResolvedValueOnce(null);
      roleService.getOne.mockResolvedValue(null);

      await expect(service.create('admin-1', createAdminDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when admin already exists', async () => {
      jest.clearAllMocks();
      usersService.getOne.mockResolvedValueOnce(mockAdmin);
      usersService.getOne.mockResolvedValueOnce(mockAdmin);
      roleService.getOne.mockResolvedValue(mockRole);

      await expect(service.create('admin-1', createAdminDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when email fails', async () => {
      jest.clearAllMocks();
      usersService.getOne.mockResolvedValueOnce(mockAdmin);
      usersService.getOne.mockResolvedValueOnce(null);
      roleService.getOne.mockResolvedValue(mockRole);
      prismaService.user.create.mockResolvedValue({
        ...mockAdmin,
        ...createAdminDto,
      });
      mailService.adminWelcome.mockRejectedValue(new Error('Email failed'));

      await expect(service.create('admin-1', createAdminDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateAdminROle', () => {
    const updateRoleDto = {
      roleId: 'role-2',
    };

    it('should update admin role successfully', async () => {
      const newRole = { ...mockRole, id: 'role-2', name: 'SuperAdmin' };

      usersService.getOne.mockResolvedValue(mockAdmin);
      roleService.getOne.mockResolvedValue(newRole);
      prismaService.user.update.mockResolvedValue({
        ...mockAdmin,
        role: newRole,
      });

      const result = await service.updateAdminROle(
        'admin-1',
        'admin-2',
        updateRoleDto,
      );

      expect(result).toHaveProperty('message', 'Admin role changed');
      expect(result).toHaveProperty('updatedAdminRole');
      expect(result.updatedAdminRole).not.toHaveProperty('password');
    });

    it('should throw NotFoundException when admin not found', async () => {
      usersService.getOne.mockResolvedValue(null);

      await expect(
        service.updateAdminROle('admin-1', 'invalid-id', updateRoleDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateAdminROle('admin-1', 'invalid-id', updateRoleDto),
      ).rejects.toThrow('Admin not found!');
    });

    it('should throw NotFoundException when role not found', async () => {
      usersService.getOne.mockResolvedValue(mockAdmin);
      roleService.getOne.mockResolvedValue(null);

      await expect(
        service.updateAdminROle('admin-1', 'admin-2', updateRoleDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateAdminROle('admin-1', 'admin-2', updateRoleDto),
      ).rejects.toThrow('Role not found!');
    });
  });

  describe('softDelete', () => {
    it('should soft delete admin successfully', async () => {
      usersService.getOne.mockResolvedValue(mockAdmin);
      prismaService.user.update.mockResolvedValue({
        ...mockAdmin,
        isDeleted: true,
        status: AccountStatus.INACTIVE,
      });

      const result = await service.softDelete('admin-1', 'admin-2');

      expect(result).toEqual({
        message: 'Admin suspended successfully!',
      });
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'admin-2',
            userType: UserType.ADMIN,
          },
          data: expect.objectContaining({
            isDeleted: true,
            status: AccountStatus.INACTIVE,
          }),
        }),
      );
    });

    it('should throw NotFoundException when admin not found', async () => {
      usersService.getOne.mockResolvedValue(null);

      await expect(service.softDelete('admin-1', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.softDelete('admin-1', 'invalid-id')).rejects.toThrow(
        'Admin not found!',
      );
    });
  });

  describe('restore', () => {
    it('should restore deleted admin successfully', async () => {
      const deletedAdmin = {
        ...mockAdmin,
        isDeleted: true,
        status: AccountStatus.INACTIVE,
      };

      usersService.getOne.mockResolvedValue(deletedAdmin);
      prismaService.user.update.mockResolvedValue({
        ...deletedAdmin,
        isDeleted: false,
        status: AccountStatus.ACTIVE,
      });

      const result = await service.restore('admin-1', 'admin-2');

      expect(result).toEqual({
        message: 'Admin restored successfully!',
      });
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'admin-2',
            userType: UserType.ADMIN,
          },
          data: expect.objectContaining({
            isDeleted: false,
            status: AccountStatus.ACTIVE,
          }),
        }),
      );
    });

    it('should throw NotFoundException when admin not found', async () => {
      usersService.getOne.mockResolvedValue(null);

      await expect(service.restore('admin-1', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.restore('admin-1', 'invalid-id')).rejects.toThrow(
        'Admin not found!',
      );
    });
  });

  describe('dashboardStats', () => {
    it('should return dashboard statistics', async () => {
      prismaService.user.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(85)
        .mockResolvedValueOnce(15);

      const result = await service.dashboardStats();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        title: 'Total Users',
        count: 100,
      });
      expect(result[1]).toEqual({
        title: 'Total Active Users',
        count: 85,
      });
      expect(result[2]).toEqual({
        title: 'Total Deleted Users',
        count: 15,
      });
    });

    it('should handle zero counts correctly', async () => {
      prismaService.user.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.dashboardStats();

      expect(result).toHaveLength(3);
      expect(result[0].count).toBe(0);
      expect(result[1].count).toBe(0);
      expect(result[2].count).toBe(0);
    });
  });

  describe('sanitizeUser', () => {
    it('should remove sensitive fields from user object', () => {
      const result = service.sanitizeUser(mockAdmin);

      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('transactionPin');
      expect(result).not.toHaveProperty('isDeleted');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('firstName');
    });

    it('should return empty object when user is null', () => {
      const result = service.sanitizeUser(null);

      expect(result).toEqual({});
    });

    it('should return empty object when user is undefined', () => {
      const result = service.sanitizeUser(undefined);

      expect(result).toEqual({});
    });
  });
});
