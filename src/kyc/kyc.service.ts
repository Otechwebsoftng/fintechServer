import { Injectable } from '@nestjs/common';
import { CustomLogger } from 'src/custom.logger';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class KycService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly usersService: UsersService,
        private readonly logger: CustomLogger,
    ){}

    
}
