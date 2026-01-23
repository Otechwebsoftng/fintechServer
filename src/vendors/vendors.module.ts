import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AirwallexService } from './airwallex.service';
import { VerificationService } from './verification-service';

@Module({
  imports: [ConfigModule],
  providers: [AirwallexService, VerificationService],
  exports: [AirwallexService, VerificationService],
})
export class VendorsModule {}
