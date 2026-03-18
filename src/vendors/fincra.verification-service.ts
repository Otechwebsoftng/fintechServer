import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APIRequest } from '../helpers/http.service';
import { BvnDto } from 'src/kyc/dto/bvn.dto';

@Injectable()
export class FincraVerificationService {
  fincraBaseUrl: string;
  fincraPrivateKey: string;
  fincraPublicKey: string;
  fincraAppId: string;
  fincraBusiness: string;
  headers: object;

  constructor(private configService: ConfigService) {
    this.fincraBaseUrl = this.configService.get('FINCRA_SANDBOX_URL');
    this.fincraPrivateKey = this.configService.get('FINCRA_API_KEY');
    this.fincraBusiness = this.configService.get('FINCRA_BUSINESS');

    this.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-key': this.fincraPrivateKey,
    };
  }

  async verifyBvn(payload: BvnDto) {
    if (!/^[0-9]{11}$/.test(payload.number)) {
      throw new BadRequestException('Verification failed, invalid BVN');
    }
    const url = 'core/bvn-verification';
    return await this.sendPostRequest(url, {
      bvn: payload.number,
      business: this.fincraBusiness,
    });

    // console.log('BVN verification response:',result);
    // if (error || !entity) {
    //   const errorMessage = error?.error || error || 'Verification failed';
    //   throw new BadRequestException(errorMessage);
    // }

    // return {
    //   status: 'successful',
    //   message: 'Verification completed successfully',
    //   data: result ?? null,
    // };
  }

  async requestAccount(payload: any) {
    const url = 'profile/virtual-accounts/requests';
    return await this.sendPostRequest(url, payload);
  }

  private async sendGetRequest(path: string) {
    const url = this.fincraBaseUrl + path;
    const httpService = new APIRequest({
      headers: this.headers,
    });

    return httpService.get(url);
  }

  private async sendPostRequest(path?: string, body?: any) {
    const url = this.fincraBaseUrl + path;
    const httpService = new APIRequest({
      headers: this.headers,
    });

    return await httpService.post(url, body);
  }
}
