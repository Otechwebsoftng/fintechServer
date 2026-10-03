import { Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { CryptoController } from './crypto.controller';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { ObiexService } from 'src/vendors/obiex.finance';
import { CustomLogger } from 'src/custom.logger';

@Module({
  imports: [AuthModule, UsersModule],
  providers: [CryptoService, ObiexService, CustomLogger],
  controllers: [CryptoController],
  exports: [CryptoService, ObiexService, CustomLogger],
})
export class CryptoModule {}
