import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('bootstrap');
  logger.log('Starting application...');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {});
  const configService = app.get<ConfigService>(ConfigService);

  // Security: Enable Helmet for HTTP security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false, // Required for Swagger
    }),
  );

  app.setGlobalPrefix('api/v1/');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true, // Reject unknown properties
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // setting up swagger documentation
  const config = new DocumentBuilder()
    .setTitle('FIN_TECh WHITE LABEL API')
    .setDescription('FIN_TECh WHITE LABEL API documentation')
    .setVersion('1.0')
    .addTag('API')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controllers.
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Keeps the token even after page refresh
    },
  });

  app.setBaseViewsDir(join(__dirname, '..', 'src/mail/templates'));
  app.setViewEngine('hbs');

  // enable CORS and allow credentials for cookies when needed by clients
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = configService.get<string | number>('PORT') ?? 3000;
  await app.listen(port);

  logger.log(`Application running on port: ${port}`);
}
bootstrap();
