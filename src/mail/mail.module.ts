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
        const host = config.get<string>('EMAIL_HOST') || 'smtp.gmail.com';
        const port = parseInt(config.get<string>('EMAIL_PORT') || '587', 10);
        const isSecure = port === 465;

        return {
          transport: {
            host: host,
            port: port,
            secure: isSecure, // true for 465 (SSL), false for 587 (TLS)
            auth: {
              user: config.get<string>('EMAIL_USER'),
              pass: config.get<string>('EMAIL_PASS'),
            },
            tls: {
              rejectUnauthorized: false,
            },
          },
          defaults: {
            from: `Whitelist <${config.get<string>('EMAIL_FROM')}>`,
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
