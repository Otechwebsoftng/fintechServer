import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guard/permission.guard';
import { RolesGuard } from '../auth/guard/role.guard';
import { AccountStatus, UserType } from '@prisma/client';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: any;

  const mockAdmin = {
    id: 'admin-1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    phoneNumber: '+1234567890',
    userType: UserType.ADMIN,
    status: AccountStatus.ACTIVE,
    isEmailVerified: true,
    role: {
      id: 'role-1',
      name: 'Admin',
      permissions: ['admin.view_all'],
    },
  };

  const mockUser = {
    id: 'user-1',
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
  };

  beforeEach(async () => {
    const mockAdminService = {
      getAll: jest.fn(),
      getAllTrashedAdmins: jest.fn(),
      viewOne: jest.fn(),
      create: jest.fn(),
      updateAdminROle: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      dashboardStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: mockAdminService }],
    })
      .overrideGuard(AuthGuard())
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAll', () => {
    it('should return paginated list of admins', async () => {
      const mockResponse = {
        pagination: {
          page: 1,
          pageSize: 10,
          hasNext: false,
          hasPrevious: false,
          count: 2,
        },
        usersWithoutPassword: [mockAdmin],
      };

      adminService.getAll.mockResolvedValue(mockResponse);

      const result = await controller.getAll(1, 10);

      expect(result).toEqual(mockResponse);
      expect(adminService.getAll).toHaveBeenCalledWith(1, 10, undefined);
    });

    it('should filter admins by search term', async () => {
      const mockResponse = {
        pagination: {
          page: 1,
          pageSize: 10,
          hasNext: false,
          hasPrevious: false,
          count: 1,
        },
        usersWithoutPassword: [mockAdmin],
      };

      adminService.getAll.mockResolvedValue(mockResponse);

      await controller.getAll(1, 10, 'admin');

      expect(adminService.getAll).toHaveBeenCalledWith(1, 10, 'admin');
    });

    it('should return admins without pagination parameters', async () => {
      const mockResponse = {
        pagination: {
          page: undefined,
          pageSize: undefined,
          hasNext: false,
          hasPrevious: false,
          count: 1,
        },
        usersWithoutPassword: [mockAdmin],
      };

      adminService.getAll.mockResolvedValue(mockResponse);

      await controller.getAll();

      expect(adminService.getAll).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('getAllTrashed', () => {
    it('should return paginated list of trashed admins', async () => {
      const trashedAdmin = {
        ...mockAdmin,
        isDeleted: true,
        status: AccountStatus.INACTIVE,
      };

      const mockResponse = {
        pagination: {
          page: 1,
          pageSize: 10,
          hasNext: false,
          hasPrevious: false,
          count: 1,
        },
        usersWithoutPassword: [trashedAdmin],
      };

      adminService.getAllTrashedAdmins.mockResolvedValue(mockResponse);

      const result = await controller.getAllTrashed(1, 10);

      expect(result).toEqual(mockResponse);
      expect(adminService.getAllTrashedAdmins).toHaveBeenCalledWith(
        1,
        10,
        undefined,
      );
    });

    it('should filter trashed admins by search term', async () => {
      const mockResponse = {
        pagination: {
          page: 1,
          pageSize: 10,
          hasNext: false,
          hasPrevious: false,
          count: 1,
        },
        usersWithoutPassword: [],
      };

      adminService.getAllTrashedAdmins.mockResolvedValue(mockResponse);

      await controller.getAllTrashed(1, 10, 'deleted');

      expect(adminService.getAllTrashedAdmins).toHaveBeenCalledWith(
        1,
        10,
        'deleted',
      );
    });
  });

  describe('dashboard', () => {
    it('should return dashboard statistics', async () => {
      const mockStats = [
        { title: 'Total Users', count: 100 },
        { title: 'Total Active Users', count: 85 },
        { title: 'Total Deleted Users', count: 15 },
      ];

      adminService.dashboardStats.mockResolvedValue(mockStats);

      const result = await controller.dashboard();

      expect(result).toEqual(mockStats);
      expect(adminService.dashboardStats).toHaveBeenCalled();
    });
  });

  describe('viewOne', () => {
    it('should return a single admin by id', async () => {
      adminService.viewOne.mockResolvedValue(mockAdmin);

      const result = await controller.viewOne('admin-1');

      expect(result).toEqual(mockAdmin);
      expect(adminService.viewOne).toHaveBeenCalledWith('admin-1');
    });
  });

  describe('create', () => {
    it('should create a new admin', async () => {
      const createAdminDto = {
        firstName: 'New',
        lastName: 'Admin',
        email: 'newadmin@example.com',
        roleId: 'role-1',
      };

      const response = {
        message: 'Admin created successfully!',
        admin: {
          ...mockAdmin,
          ...createAdminDto,
          id: 'new-admin-1',
        },
      };

      adminService.create.mockResolvedValue(response);

      const result = await controller.create(createAdminDto, mockUser as any);

      expect(result).toEqual(response);
      expect(adminService.create).toHaveBeenCalledWith(
        mockUser.id,
        createAdminDto,
      );
    });
  });

  describe('update', () => {
    it('should update admin role', async () => {
      const updateRoleDto = {
        roleId: 'role-2',
      };

      const response = {
        message: 'Admin role changed',
        updatedAdminRole: {
          ...mockAdmin,
          role: {
            id: 'role-2',
            name: 'SuperAdmin',
          },
        },
      };

      adminService.updateAdminROle.mockResolvedValue(response);

      const result = await controller.update(
        'admin-2',
        updateRoleDto,
        mockUser as any,
      );

      expect(result).toEqual(response);
      expect(adminService.updateAdminROle).toHaveBeenCalledWith(
        mockUser.id,
        'admin-2',
        updateRoleDto,
      );
    });
  });

  describe('softDelete', () => {
    it('should soft delete an admin', async () => {
      const response = {
        message: 'Admin suspended successfully!',
      };

      adminService.softDelete.mockResolvedValue(response);

      const result = await controller.softDelete('admin-2', mockUser as any);

      expect(result).toEqual(response);
      expect(adminService.softDelete).toHaveBeenCalledWith(
        mockUser.id,
        'admin-2',
      );
    });
  });

  describe('restore', () => {
    it('should restore a deleted admin', async () => {
      const response = {
        message: 'Admin restored successfully!',
      };

      adminService.restore.mockResolvedValue(response);

      const result = await controller.restore('admin-2', mockUser as any);

      expect(result).toEqual(response);
      expect(adminService.restore).toHaveBeenCalledWith(
        mockUser.id,
        'admin-2',
      );
    });
  });

  describe('delete', () => {
    it('should permanently delete an admin', async () => {
      const response = {
        message: 'Admin suspended successfully!',
      };

      adminService.softDelete.mockResolvedValue(response);

      const result = await controller.delete('admin-2', mockUser as any);

      expect(result).toEqual(response);
      expect(adminService.softDelete).toHaveBeenCalledWith(
        mockUser.id,
        'admin-2',
      );
    });
  });
});
