import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { CustomLogger } from '../custom.logger';
import { InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock fs
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('MailService', () => {
  let service: MailService;
  let mailerService: any;
  let configService: any;
  let logger: any;

  const mockConfigValues = {
    NODE_ENV: 'development',
    EMAIL_FROM: 'noreply@example.com',
    EMAIL_USER: 'test@example.com',
    BREVO_API_URL: 'https://api.brevo.com/v3/smtp/email',
    BREVO_API_KEY: 'test-api-key',
  };

  beforeEach(async () => {
    const mockMailerService = {
      sendMail: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => mockConfigValues[key]),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: mockMailerService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CustomLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    mailerService = module.get(MailerService);
    configService = module.get(ConfigService);
    logger = module.get(CustomLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('welcomeMail', () => {
    const email = 'user@example.com';
    const firstName = 'John';
    const token = 123456;

    it('should send welcome email via SMTP in development', async () => {
      mailerService.sendMail.mockResolvedValue(true);

      await service.welcomeMail(email, firstName, token);

      expect(logger.log).toHaveBeenCalledWith(`welcome email sent to ${email}`);
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'WhiteLabel noreply@example.com',
          to: email,
          subject: 'Welcome',
          template: 'welcome',
          context: expect.objectContaining({
            email,
            firstName,
            token,
            year: expect.any(Number),
          }),
        }),
      );
      expect(logger.log).toHaveBeenCalledWith(
        `Email sent successfully to ${email}`,
      );
    });

    it('should send welcome email via Brevo API in production', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'NODE_ENV' ? 'production' : mockConfigValues[key],
      );

      // Recreate service with production config
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          { provide: MailerService, useValue: mailerService },
          { provide: ConfigService, useValue: configService },
          { provide: CustomLogger, useValue: logger },
        ],
      }).compile();

      service = module.get<MailService>(MailService);

      mockedFs.readFileSync.mockReturnValue(
        '<html><body>Welcome {{firstName}}, your token is {{token}}</body></html>',
      );
      mockedAxios.post.mockResolvedValue({ data: { messageId: 'test-id' } });

      await service.welcomeMail(email, firstName, token);

      expect(logger.log).toHaveBeenCalledWith(`welcome email sent to ${email}`);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        mockConfigValues.BREVO_API_URL,
        expect.objectContaining({
          sender: {
            email: mockConfigValues.EMAIL_USER,
            name: 'WhiteLabel',
          },
          to: [{ email, name: firstName }],
          subject: 'Welcome',
        }),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'api-key': mockConfigValues.BREVO_API_KEY,
          },
        }),
      );
      expect(logger.log).toHaveBeenCalledWith(
        `Email sent successfully to ${email}`,
      );
    });

    it('should throw InternalServerErrorException when email fails', async () => {
      const error = new Error('SMTP connection failed');
      mailerService.sendMail.mockRejectedValue(error);

      await expect(
        service.welcomeMail(email, firstName, token),
      ).rejects.toThrow(InternalServerErrorException);
      expect(logger.error).toHaveBeenCalledWith(
        `Failed to send email to ${email}`,
        error.stack,
      );
    });
  });

  describe('sendOtp', () => {
    const email = 'user@example.com';
    const firstName = 'John';
    const token = 654321;

    it('should send OTP email via SMTP', async () => {
      mailerService.sendMail.mockResolvedValue(true);

      await service.sendOtp(email, firstName, token);

      expect(logger.log).toHaveBeenCalledWith(`OTP email sent to ${email}`);
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'WhiteLabel noreply@example.com',
          to: email,
          subject: 'OTP',
          template: 'reset',
          context: expect.objectContaining({
            email,
            firstName,
            token,
            year: expect.any(Number),
          }),
        }),
      );
      expect(logger.log).toHaveBeenCalledWith(
        `Email sent successfully to ${email}`,
      );
    });

    it('should handle OTP email sending errors', async () => {
      const error = new Error('Network timeout');
      mailerService.sendMail.mockRejectedValue(error);

      await expect(service.sendOtp(email, firstName, token)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(logger.error).toHaveBeenCalledWith(
        `Failed to send email to ${email}`,
        error.stack,
      );
    });
  });

  describe('adminWelcome', () => {
    const email = 'admin@example.com';
    const firstName = 'Admin';
    const role = 'SuperAdmin';
    const password = 'TempPassword123';

    it('should send admin onboarding email via SMTP', async () => {
      mailerService.sendMail.mockResolvedValue(true);

      await service.adminWelcome(email, firstName, role, password);

      expect(logger.log).toHaveBeenCalledWith(
        `log in credentials sent to ${email}`,
      );
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'WhiteLabel noreply@example.com',
          to: email,
          subject: 'Admin Onboarding',
          template: 'adminOnboarding',
          context: expect.objectContaining({
            email,
            firstName,
            role,
            password,
            year: expect.any(Number),
          }),
        }),
      );
      expect(logger.log).toHaveBeenCalledWith(
        `Email sent successfully to ${email}`,
      );
    });

    it('should handle admin email sending errors', async () => {
      const error = new Error('Invalid recipient');
      mailerService.sendMail.mockRejectedValue(error);

      await expect(
        service.adminWelcome(email, firstName, role, password),
      ).rejects.toThrow(InternalServerErrorException);
      expect(logger.error).toHaveBeenCalledWith(
        `Failed to send email to ${email}`,
        error.stack,
      );
    });
  });

  describe('sendDefaultMail', () => {
    it('should include current year in context', async () => {
      const currentYear = new Date().getFullYear();
      mailerService.sendMail.mockResolvedValue(true);

      await service.welcomeMail('test@example.com', 'Test', 123456);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            year: currentYear,
          }),
        }),
      );
    });

    it('should use correct sender format', async () => {
      mailerService.sendMail.mockResolvedValue(true);

      await service.welcomeMail('test@example.com', 'Test', 123456);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'WhiteLabel noreply@example.com',
        }),
      );
    });
  });

  describe('environment-based email sending', () => {
    it('should use SMTP in development environment', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'NODE_ENV' ? 'development' : mockConfigValues[key],
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          { provide: MailerService, useValue: mailerService },
          { provide: ConfigService, useValue: configService },
          { provide: CustomLogger, useValue: logger },
        ],
      }).compile();

      service = module.get<MailService>(MailService);
      mailerService.sendMail.mockResolvedValue(true);

      await service.sendOtp('test@example.com', 'Test', 123456);

      expect(mailerService.sendMail).toHaveBeenCalled();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should use Brevo API in production environment', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'NODE_ENV' ? 'production' : mockConfigValues[key],
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          { provide: MailerService, useValue: mailerService },
          { provide: ConfigService, useValue: configService },
          { provide: CustomLogger, useValue: logger },
        ],
      }).compile();

      service = module.get<MailService>(MailService);

      mockedFs.readFileSync.mockReturnValue('<html><body>Test</body></html>');
      mockedAxios.post.mockResolvedValue({ data: { messageId: 'test-id' } });

      await service.sendOtp('test@example.com', 'Test', 123456);

      expect(mockedAxios.post).toHaveBeenCalled();
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should log error details when email sending fails', async () => {
      const error = new Error('SMTP server unavailable');
      error.stack = 'Error stack trace';
      mailerService.sendMail.mockRejectedValue(error);

      await expect(
        service.welcomeMail('test@example.com', 'Test', 123456),
      ).rejects.toThrow(InternalServerErrorException);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send email to test@example.com',
        error.stack,
      );
    });

    it('should throw InternalServerErrorException with error message', async () => {
      const errorMessage = 'Connection timeout';
      mailerService.sendMail.mockRejectedValue(new Error(errorMessage));

      await expect(
        service.sendOtp('test@example.com', 'Test', 123456),
      ).rejects.toThrow(`Failed to send email: ${errorMessage}`);
    });
  });
});
