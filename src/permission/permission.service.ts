import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async getOne(criteria: any) {
    return await this.prisma.permission.findUnique({
      where: {
        ...criteria,
      },
    });
  }

  async getAll() {
    return this.prisma.permission.findMany();
  }



  async viewOne(slug: string) {
    const permission = await this.getOne({ slug });
    if (!permission) {
      throw new ConflictException('Permission not found');
    }
    return permission;
  }
}
