// prisma.service.ts
import {
    INestApplication,
    InternalServerErrorException,
    OnModuleInit,
  } from '@nestjs/common';
  import { PrismaClient } from '@prisma/client';
  import { Logger } from '@nestjs/common';
  
  export class PrismaService extends PrismaClient implements OnModuleInit {
    async onModuleInit() {
      const logger = new Logger('Database connection');
      try {
        logger.log('Connecting to the database...');
        await this.$connect();
        logger.log('Connected 😁😁');
      } catch (error) {
        logger.verbose('Failed to connect to the database 🔥🔥🔥', error.stack);
        throw new InternalServerErrorException(
          'Database connection Failed!!!',
          error,
        );
      }
    }
  
    async enableShutdownHooks(app: INestApplication) {
      const logger = new Logger();
  
      process.on('SIGINT', async () => {
        logger.log('Received SIGINT. Shutting down gracefully...');
        await app.close();
      });
    }
  }
  