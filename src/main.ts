import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const logger = new Logger('bootstrap');
  logger.log('Starting application...');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {});
  const configService = app.get<ConfigService>(ConfigService);

  

  app.setGlobalPrefix('api/v1/');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // setting up swagger documentation
  const config = new DocumentBuilder()
    .setTitle('FIN_TECh WHITE LABEL API')
    .setDescription('FIN_TECh WHITE LABEL API documentation')
    .setVersion('1.0')
    .addTag('API')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1', app, document);

  app.setBaseViewsDir(join(__dirname, '..', 'src/mail/templates'));
  app.setViewEngine('hbs');

  // enable CORS and allow credentials for cookies when needed by clients
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // parse cookies on incoming requests so controllers can read req.cookies
  app.use(cookieParser());
  const port = configService.get<string | number>('PORT') ?? 3000;
  await app.listen(port);

  logger.log(`Application running on port: ${port}`);
}
bootstrap();
