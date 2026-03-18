import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FincraVerificationService } from './fincra.verification-service';
import { DojahVerificationService } from './dojah.verification';

@Module({
  imports: [ConfigModule],
  providers: [FincraVerificationService, DojahVerificationService],
  exports: [FincraVerificationService, DojahVerificationService],
})
export class VendorsModule {}
