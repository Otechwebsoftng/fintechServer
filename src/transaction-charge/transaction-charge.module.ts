import { Module } from '@nestjs/common';
import { TransactionChargeService } from './transaction-charge.service';
import { TransactionChargeController } from './transaction-charge.controller';

@Module({
  providers: [TransactionChargeService],
  controllers: [TransactionChargeController]
})
export class TransactionChargeModule {}
