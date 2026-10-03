import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APIRequest } from '../helpers/http.service';

@Injectable()
export class SmileIdVerificationService {
  private readonly baseUrl: string;
  private apiKey: string;
  private partnerId: string;
  headers: object;

  constructor(private configService: ConfigService) {
    // this.baseUrl = this.configService.get('SMILE_STAGING_URL');
    this.baseUrl = this.configService.get('SMILE_PRODUCTION_URL');
    this.apiKey = this.configService.get('SMILE_API_KEY');
    this.partnerId = this.configService.get('SMILE_PARTNER_ID');
  }

  private async getAccessToken(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v3/token`, {
      method: 'POST',
      headers: {
        'smileid-partner-id': this.partnerId,
        'smileid-api-key': this.apiKey,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Smile ID token error:', data);

      throw new BadRequestException(
        data?.message || 'Unable to authenticate with Smile ID',
      );
    }

    return data.token;
  }
  async verifyBvn(payload: any) {
    const token = await this.getAccessToken();

    const formData = new FormData();

    formData.append('country', payload.country);
    formData.append('id_type', payload.id_type);
    formData.append('id_number', payload.id_number);

    formData.append('user_details', JSON.stringify(payload.user_details));

    formData.append('consent', JSON.stringify(payload.consent));

    if (payload.user_id) {
      formData.append('user_id', payload.user_id);
    }

    if (payload.callback_url) {
      formData.append('callback_url', payload.callback_url);
    }

    const response = await fetch(`${this.baseUrl}/v3/enhanced_kyc`, {
      method: 'POST',
      headers: {
        'SmileID-Token': token,
      },
      body: formData,
    });

    const data = await response.json();

    console.log('Smile ID BVN response:', {
      status: response.status,
      data,
    });

    if (!response.ok) {
      throw new BadRequestException(
        data?.message || 'Unable to submit BVN verification',
      );
    }

    return {
      status: data.status,
      message: data.message,
      data,
    };
  }

  async verifyNin(number: string) {
    if (!/^[0-9]{11}$/.test(number))
      throw new BadRequestException('Verification failed, invalid NIN');
    const url = '/kyc/nin?nin=' + number;
    const { entity = false, error = false } = await this.sendGetRequest(url);
    if (error || !entity) throw new BadRequestException('Verification failed');

    return {
      status: 'successful',
      message: 'Verification completed successfully',
      data: entity ?? null,
    };
  }

  async verifyDriversLicense(number: string) {
    if (!/^[a-zA-Z]{3}([ -]{1})?[A-Z0-9]{6,12}$/i.test(number))
      throw new BadRequestException(
        'Verification failed, invalid licence number',
      );
    const url = '/kyc/dl?license_number=' + number;
    const { entity = false, error = false } = await this.sendGetRequest(url);
    if (error || !entity) throw new BadRequestException('Verification failed');

    return {
      status: 'successful',
      message: 'Verification completed successfully',
      data: entity ?? null,
    };
  }

  async internationalPassport(number: string) {
    const url = '/kyc/passport?passport_number=' + number;
    const { entity = false, error = false } = await this.sendGetRequest(url);
    if (error || !entity) throw new BadRequestException('Verification failed');

    return {
      status: 'successful',
      message: 'Verification completed successfully',
      data: entity ?? null,
    };
  }

  async verifyUtilityBillImage(payload: any) {
    const url = '/document/analysis/utility_bill';
    const { entity = false, error = false } = await this.post(url, payload);
    if (error || !entity) throw new BadRequestException('Verification failed');

    return {
      status: 'successful',
      message: 'Utility bill verification completed successfully',
      data: entity ?? null,
    };
  }
  async verifyDocumentImage(imageUrl: string) {
    const url = '/dl?license_number=' + imageUrl;
    const { entity = false, error = false } = await this.sendGetRequest(url);
    if (error || !entity) throw new BadRequestException('Verification failed');

    //upload front image to cloudinary
    // const frontImageUrl =  await Utility.uploadImage(frontImgFilePath, 'drivers_license');
    // const backImageUrl =  await Utility.uploadImage(backImgFilePath, 'drivers_license');

    return {
      status: 'successful',
      message: 'Verification completed successfully',
      data: entity ?? null,
    };
  }

  async verifyVoterId(number: string) {
    if (!/^[a-zA-Z0-9 ]{9,29}$/i.test(number))
      throw new BadRequestException('Verification failed, invalid voter ID');
    const url = '/kyc/vin?vin=' + number;
    const { entity = false, error = false } = await this.sendGetRequest(url);
    if (error || !entity) throw new BadRequestException('Verification failed');

    return {
      status: 'successful',
      message: 'Verification completed successfully',
      data: entity ?? null,
    };
  }

  async verifyIdentity(identityType, number) {
    switch (identityType) {
      case 'NIN':
        return this.verifyNin(number);
      case 'DRIVERS_LICENSE':
        return this.verifyDriversLicense(number);
      case 'VOTER_CARD':
        return this.verifyVoterId(number);
      case 'PASSPORT':
        return this.internationalPassport(number);
      default:
    }
  }

  private http(headers?: Record<string, string>) {
    return new APIRequest({
      headers: headers,
      timeout: 30000,
    });
  }

  private async sendGetRequest(path: string) {
    const url = this.baseUrl + path;
    const httpService = new APIRequest({
      headers: this.headers,
    });

    return httpService.get(url);
  }

  private async post(path: string, body: any, headers?: any, method?: string) {
    return this.http(headers).post(`${this.baseUrl}${path}`, body);
  }
}
