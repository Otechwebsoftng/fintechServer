import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Chance from 'chance';

export default class APIFeatures {
  @Inject(ConfigService)
  static async assignJwtToken(
    user: { id: string; email: string },
    jwtService: JwtService,
  ): Promise<string> {
    const payload = {
      id: user.id,
      email: user.email,
    };
    const config = new ConfigService();
    const token = jwtService.sign(payload, {
      secret: config.get<string>('JWT_SECRET'),
    });
    return token;
  }

  static async generateOtp() {
    const token = Math.floor(1000 + Math.random() * 9000);
    const currentTime = new Date();
    const config = new ConfigService();
    const otpExpires = new Date(
      currentTime.getTime() + config.get<any>('OTP_EXPIRES') * 60 * 1000,
    );

    return { token, otpExpires };
  }
}
