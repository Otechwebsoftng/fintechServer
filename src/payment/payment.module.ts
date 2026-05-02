import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { CustomLogger } from 'src/custom.logger';

@Module({
  imports: [AuthModule, UsersModule],
  providers: [PaymentService, CustomLogger],
  controllers: [PaymentController],
  exports: [PaymentService, CustomLogger],
})
export class PaymentModule {}
