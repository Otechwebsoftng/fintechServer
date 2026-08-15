import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { Utility } from 'src/helpers/utilities.service';
import * as bcrypt from 'bcrypt';
import { AccountStatus, Prisma, UserType } from '@prisma/client';
import { MailService } from 'src/mail/mail.service';
import { RoleService } from 'src/role/role.service';
import { CustomLogger } from 'src/custom.logger';
import { CreateAdminDto } from './dto/createAdmin.dto';
import { UpdateAdminRoleDto } from './dto/updateAdminRole.dto';
const SALT_ROUND = 10;
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly roleService: RoleService,
    private readonly mailService: MailService,
    private readonly logger: CustomLogger,
  ) {}

  async getAll(page?: number, pageSize?: number, search?: string) {
    const shouldPaginate =
      page && pageSize && !isNaN(Number(page)) && !isNaN(Number(pageSize));

    const skip = shouldPaginate ? (page - 1) * pageSize : undefined;
    const take = shouldPaginate ? pageSize : undefined;

    const whereClause: any = {
      userType: UserType.ADMIN,
    };

    if (search) {
      whereClause.OR = [
        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [users, count] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        include: {
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip,
        take,
      }),
      this.prisma.user.count({
        where: whereClause,
      }),
    ]);

    const hasNext = shouldPaginate && skip + take < count;
    const hasPrevious = shouldPaginate && page > 1;

    const usersWithoutPassword = users.map((user) => {
      const {
        password: _,
        isDeleted,
        transactionPin: __,
        ...userWithoutPassword
      } = user;
      return userWithoutPassword;
    });

    return {
      pagination: {
        page: page,
        pageSize: pageSize,
        hasNext,
        hasPrevious,
        count,
      },
      usersWithoutPassword,
    };
  }

  async getAllTrashedAdmins(page?: number, pageSize?: number, search?: string) {
    const shouldPaginate =
      page && pageSize && !isNaN(Number(page)) && !isNaN(Number(pageSize));

    const skip = shouldPaginate ? (page - 1) * pageSize : undefined;
    const take = shouldPaginate ? pageSize : undefined;

    const whereClause: any = {
      userType: UserType.ADMIN,
      isDeleted: true,
      status: AccountStatus.INACTIVE,
    };

    if (search) {
      whereClause.OR = [
        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [users, count] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        include: {
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip,
        take,
      }),
      this.prisma.user.count({
        where: whereClause,
      }),
    ]);

    const hasNext = shouldPaginate && skip + take < count;
    const hasPrevious = shouldPaginate && page > 1;

    const usersWithoutPassword = users.map((user) => {
      const {
        password: _,
        isDeleted,
        status,
        transactionPin: __,
        ...userWithoutPassword
      } = user;
      return userWithoutPassword;
    });

    return {
      pagination: {
        page: page,
        pageSize: pageSize,
        hasNext,
        hasPrevious,
        count,
      },
      usersWithoutPassword,
    };
  }

  async viewOne(adminId: string) {
    const admin = await this.usersService.getOne({
      where: {
        id: adminId,
        userType: UserType.ADMIN,
      },
    });
    if (!admin) {
      throw new NotFoundException('Admin not found!');
    }
    return this.sanitizeUser(admin);
  }

  async create(adminId: string, payload: CreateAdminDto) {
    const [creator, existingAdminByEmail, role] = await Promise.all([
      this.usersService.getOne({
        where: { id: adminId, userType: UserType.ADMIN },
      }),
      this.usersService.getOne({ where: { email: payload.email } }),
      this.roleService.getOne({ id: payload.roleId }),
    ]);

    if (!creator) {
      throw new NotFoundException('Creator user not found.');
    }

    if (!role) {
      throw new NotFoundException('Role not found!');
    }

    const generatePassword = Utility.randomPassword();

    const hashPassword = await bcrypt.hash(generatePassword, SALT_ROUND);

    if (existingAdminByEmail) {
      throw new ConflictException('Admin already exists');
    }

    const adminDetails = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      password: hashPassword,
      userType: UserType.ADMIN,
      status: AccountStatus.ACTIVE,
    };

    const newAdmin = await this.prisma.user.create({
      data: {
        ...adminDetails,
        role: {
          connect: {
            id: role.id,
          },
        },
        createdBy: {
          connect: {
            id: adminId,
          },
        },
      },
    });

    void this.mailService.adminWelcome(
      adminDetails.email,
      adminDetails.firstName,
      role.name,
      generatePassword,
    );

    return {
      message: 'Admin created successfully!',
      admin: this.sanitizeUser(newAdmin),
    };
  }

  async updateAdminROle(
    adminId: string,
    userId: string,
    payload: UpdateAdminRoleDto,
  ) {
    try {
      const role = await this.roleService.getOne({ id: payload.roleId });
      if (!role) {
        throw new NotFoundException('Role not found!');
      }

      const updatedAdminRole = await this.prisma.user.update({
        where: { id: userId, userType: UserType.ADMIN },
        data: {
          role: {
            connect: {
              id: role.id,
            },
          },

          lastUpdatedBy: {
            connect: {
              id: adminId,
            },
          },
          updatedAt: new Date(),
        },
      });

      const withoutPassword = this.sanitizeUser(updatedAdminRole);

      return {
        message: 'Admin role changed',
        updatedAdminRole: withoutPassword,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2025':
            throw new NotFoundException('Admin or role not found');
        }
      }
      this.logger.error(`Failed to update admin role for user ${userId}`);

      throw new InternalServerErrorException('Failed to update admin role.');
    }
  }

  async softDelete(adminId: string, id: string) {
    try {
      await this.prisma.user.update({
        where: {
          id: id,
          isDeleted: false,
          userType: UserType.ADMIN,
        },
        data: {
          status: AccountStatus.INACTIVE,
          isDeleted: true,
          updatedAt: new Date(),
          updaterId: adminId,
        },
      });

      return {
        message: 'Admin suspended successfully!',
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2025':
            throw new NotFoundException('Admin not found. or already deleted');
        }
      }

      this.logger.error('Failed to permanently delete Admin');

      throw new InternalServerErrorException('Failed to soft delete a admin.');
    }
  }

  async restore(adminId: string, id: string) {
    try {
      await this.prisma.user.update({
        where: {
          id: id,
          isDeleted: false,
          userType: UserType.ADMIN,
        },
        data: {
          isDeleted: false,
          status: AccountStatus.ACTIVE,
          updatedAt: new Date(),
          updaterId: adminId,
        },
      });

      return {
        message: 'Admin restored successfully!',
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2025':
            throw new NotFoundException('Admin not found. or already deleted');
        }
      }

      this.logger.error('Failed to restore deleted Admin');

      throw new InternalServerErrorException(
        'Failed to restore deleted a admin.',
      );
    }
  }

  async dashboardStats() {
    const [
      totalNumberOfUsers,
      totalNumberOfActiveUsers,
      totalNumberOfDeletedUsers,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { userType: UserType.USER },
      }),
      this.prisma.user.count({
        where: {
          userType: UserType.USER,
          status: AccountStatus.ACTIVE,
          isDeleted: false,
        },
      }),
      this.prisma.user.count({
        where: {
          userType: UserType.USER,
          status: AccountStatus.INACTIVE,
          isDeleted: true,
        },
      }),
    ]);

    return Promise.resolve([
      {
        title: 'Total Users',
        count: totalNumberOfUsers,
      },
      {
        title: 'Total Active Users',
        count: totalNumberOfActiveUsers,
      },
      {
        title: 'Total Deleted Users',
        count: totalNumberOfDeletedUsers,
      },
    ]);
  }

  sanitizeUser(user) {
    if (!user) return {};
    const { password, isDeleted, transactionPin, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}
