import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { template } from 'handlebars';
import { CustomLogger } from 'src/custom.logger';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';

@Injectable()
export class MailService {
  private readonly useApi: boolean;

  constructor(
    private readonly customLogger: CustomLogger,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    // Use API in production (Render), SMTP in local development
    this.useApi = this.configService.get<string>('NODE_ENV') === 'production';
  }

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
    templateName,
    context,
  ): Promise<void> {
    try {
      if (this.useApi) {
        // Use Brevo API for production
        await this.sendViaBrevoAPI(email, subject, templateName, context);
      } else {
        // Use SMTP for local development
        await this.sendViaSMTP(email, subject, templateName, context);
      }
      this.customLogger.log(`Email sent successfully to ${email}`);
    } catch (error) {
      this.customLogger.error(`Failed to send email to ${email}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to send email: ${error.message}`,
        `Failed to send email: ${error.stack}`,
      );
    }
  }

  private async sendViaSMTP(
    email: string,
    subject: string,
    templateName: string,
    context: any,
  ): Promise<void> {
    const mailOptions = {
      from: `WhiteLabel ${this.configService.get<string>('EMAIL_FROM')}`,
      to: email,
      subject,
      template: templateName,
      context: { ...context, year: new Date().getFullYear() },
    };
    await this.mailerService.sendMail(mailOptions);
  }

  private async sendViaBrevoAPI(
    email: string,
    subject: string,
    templateName: string,
    context: any,
  ): Promise<void> {
    // Read and compile the Handlebars template
    const templatePath = path.join(
      process.cwd(),
      'src/assets/templates',
      `${templateName}.hbs`,
    );
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const compiledTemplate = Handlebars.compile(templateContent);
    const htmlContent = compiledTemplate({
      ...context,
      year: new Date().getFullYear(),
    });

    // Brevo API request
    const brevoApiUrl = this.configService.get<string>('BREVO_API_URL');
    const brevoApiKey = this.configService.get<string>('BREVO_API_KEY');

    const payload = {
      sender: {
        email: this.configService.get<string>('EMAIL_USER'),
        name: 'WhiteLabel',
      },
      to: [
        {
          email: email,
          name: context.firstName || '',
        },
      ],
      subject: subject,
      htmlContent: htmlContent,
    };

    await axios.post(brevoApiUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'api-key': brevoApiKey,
      },
    });
  }
}
