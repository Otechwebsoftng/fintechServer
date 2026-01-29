import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { CustomLogger } from 'src/custom.logger';

@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: async (config: ConfigService) => ({
        transport: {
          host: config.get<string>('ZOHO_HOST'),
          port: config.get<string>('ZOHO_PORT'),
          secure: true,
          // config.get<string>('NODE_ENV') === 'production' ? true : false,
          auth: {
            user: config.get<string>('EMAIL_USER'),
            pass: config.get<string>('EMAIL_PASS'),
          },
          tls: {
            rejectUnauthorized: false,
          },
          // Added connection timeout and retry options
          connectionTimeout: 30000, // 30 seconds
          socketTimeout: 30000, // 30 seconds
          greetingTimeout: 30000, // 30 seconds
          pool: true, // Use connection pooling
          maxConnections: 5, // Maximum connections in pool
          maxRetries: 3,
        },
        defaults: {
          from: `WhiteLabel <${config.get<string>('EMAIL_USER')}>`,
        },
        template: {
          dir: join(process.cwd(), 
          'src/assets/templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MailService, CustomLogger],
  exports: [MailService],
})
export class MailModule {}
