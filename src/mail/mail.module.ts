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
      useFactory: async (config: ConfigService) => {
        const port = parseInt(config.get<string>('EMAIL_PORT') || '587', 10);
        const isProduction = config.get<string>('NODE_ENV') === 'production';
        
        return {
          transport: {
            host: config.get<string>('EMAIL_HOST'),
            port: port,
            secure: port === 465, // true for 465, false for other ports
            auth: {
              user: config.get<string>('EMAIL_USER'),
              pass: config.get<string>('EMAIL_PASS'),
            },
            // Add these settings for Render and other cloud platforms
            tls: {
              rejectUnauthorized: isProduction, // Allow self-signed certs in dev
              ciphers: 'SSLv3',
            },
            connectionTimeout: 10000, // 10 seconds
            greetingTimeout: 10000,
            socketTimeout: 30000, // 30 seconds
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            // logger: true, // Enable logging for debugging
            // debug: !isProduction, // Debug mode in development
          },
          defaults: {
            from: `Whitelist  <${config.get<string>('EMAIL_FROM')}>`,
          },
          template: {
            dir: join(process.cwd(), 'src/assets/templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [MailService, CustomLogger],
  exports: [MailService],
})
export class MailModule {}
