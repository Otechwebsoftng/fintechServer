import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from 'src/users/users.module';
import { JwtStrategy } from './jwt.strategy';
import { MailModule } from 'src/mail/mail.module';
import { CustomLogger } from 'src/custom.logger';
import { WalletModule } from 'src/wallet/wallet.module';
import { AirwallexService } from 'src/vendors/airwallex.service';

@Module({
  imports: [
    // Setting up JWT
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          secret: config.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: config.get<string>('JWT_EXPIRES'),
          },
        };
      },
    }),
    ConfigModule,
    forwardRef(() => UsersModule),
    MailModule,
    forwardRef(() => WalletModule),
  ],
  providers: [AuthService, CustomLogger, JwtStrategy, AirwallexService],
  controllers: [AuthController],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
