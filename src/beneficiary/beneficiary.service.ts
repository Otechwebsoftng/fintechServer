import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { CreateBeneficiaryDto } from './dto/createBeneficiary.dto';

@Injectable()
export class BeneficiaryService {
  constructor(
    readonly prisma: PrismaService,
    readonly usersService: UsersService,
  ) {}

  async getAll(
    userId: string,
    page?: number,
    pageSize?: number,
    search?: string,
  ) {
    const shouldPaginate =
      page && pageSize && !isNaN(Number(page)) && !isNaN(Number(pageSize));

    const skip = shouldPaginate ? (page - 1) * pageSize : 0;
    const take = shouldPaginate ? pageSize : undefined;

    const baseWhere: any = {
      userId,
    };

    const whereClause: any = { ...baseWhere };

    if (search) {
      whereClause.OR = [
        { bankName: { contains: search, mode: 'insensitive' } },
        { accountName: { contains: search, mode: 'insensitive' } },
        { accountNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [result, count] = await Promise.all([
      this.prisma.beneficiary.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        skip,
        take,
      }),
      this.prisma.beneficiary.count({
        where: whereClause,
      }),
    ]);
    const hasNext = shouldPaginate ? skip + (take ?? count) < count : false;
    const hasPrevious = shouldPaginate ? page > 1 : false;

    return {
      pagination: {
        page: page,
        pageSize: pageSize,
        hasNext,
        hasPrevious,
        count,
      },
      data: result,
    };
  }

  async getOne(criteria: any) {
    return this.prisma.beneficiary.findFirst({
      where: criteria,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async viewOne(beneficiaryId: string) {
    const beneficiary = await this.getOne({
      id: beneficiaryId,
    });

    if (!beneficiary) {
      throw new Error('Beneficiary not found');
    }

    return {
      message: 'Beneficiary fetched successfully',
      data: beneficiary,
    };
  }

  async createBeneficiary(userId: string, payload: CreateBeneficiaryDto) {

    const user = await this.usersService.getOne({
      id: userId,
    });

    if (!user) {
      throw new Error('User not found');
    }

    const existingBeneficiary = await this.getOne({
      userId: user.id,
      accountNumber: payload.accountNumber,
    });

    if (existingBeneficiary) {
      throw new ConflictException('Already added this beneficiary');
    }

    const beneficiary = await this.prisma.beneficiary.create({
      data: {
        userId: user.id,
        country: payload.country,
        bankName: payload.bankName,
        accountNumber: payload.accountNumber,
        accountName: payload.accountName,
        bankCode: payload.bankCode,
      },
    });

    return {
      message: 'Beneficiary created successfully',
      data: beneficiary,
    };
  }

  async deleteBeneficiary(userId: string, beneficiaryId: string) {
    try {
      await this.prisma.beneficiary.delete({
        where: {
          id: beneficiaryId,
          userId: userId,
        },
      });

      return {
        message: 'Beneficiary deleted successfully',
      };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new Error('Beneficiary not found');
      }
      throw error;
    }
  }
}
