import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { UsersModule } from 'src/users/users.module';
import { CustomLogger } from 'src/custom.logger';
import { MailModule } from 'src/mail/mail.module';
import { WebhookService } from './webhooks.service';
import { SignatureService } from './signature.service';

@Module({
  imports: [MailModule, UsersModule],
  providers: [WebhookService, CustomLogger, SignatureService],
  controllers: [WebhooksController],
  exports: [WebhookService, SignatureService],
})
export class WebhooksModule {}
