import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { template } from 'handlebars';
import { CustomLogger } from 'src/custom.logger';

@Injectable()
export class MailService {
  constructor(
    private readonly customLogger: CustomLogger,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async welcomeMail(email: string, firstName: string, token: number) {
    const subject = 'Welcome';
    this.customLogger.log(`welcome email sent to ${email}`);
    await this.sendDefaultMail(email, subject, 'welcome', {
      email,
      firstName,
      token,
    });
  }

  async sendOtp(email: string, firstName: string, token: number) {
    const subject = 'OTP';
    this.customLogger.log(`OTP email sent to ${email}`);
    await this.sendDefaultMail(email, subject, 'reset', {
      email,
      firstName,
      token,
    });
  }

  async adminWelcome(
    email: string,
    firstName: string,
    role: string,
    password: string,
  ) {
    const subject = 'Admin Onboarding';
    this.customLogger.log(`log in credentials sent to ${email}`);
    await this.sendDefaultMail(email, subject, 'adminOnboarding', {
      email,
      firstName,
      role,
      password,
    });
  }

  private async sendDefaultMail(
    email,
    subject,
    template,
    context,
  ): Promise<void> {
    const mailOptions = {
      from: `WhiteLabel ${this.configService.get<string>('EMAIL_FROM')}`,
      to: email,
      subject,
      template,
      context: { ...context, year: new Date().getFullYear() },
    };
    await this.mailerService.sendMail(mailOptions);
  }
}
