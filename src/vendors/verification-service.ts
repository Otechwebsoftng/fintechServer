import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APIRequest } from '../helpers/http.service';
import { Utility } from 'src/helpers/utilities.service';

@Injectable()
export class VerificationService {
  baseUrl: string;
  publicKey: string;
  privateKey: string;
  appId: string;
  headers: object; 

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get('DOJAH_BASE_URL');
    this.publicKey = this.configService.get('DOJAH_PUBLIC_KEY');
    this.privateKey = this.configService.get('DOJAH_PRIVATE_KEY');
    this.appId = this.configService.get('DOJAH_APP_ID');
    this.headers = {
      AppId: this.appId,
      Authorization: this.privateKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async verifyBvn(number: string) {
    if (!/^[0-9]{11}$/.test(number))
      throw new BadRequestException('Verification failed, invalid BVN');
    const url = '/kyc/bvn?bvn=' + number;
    const { entity = false, error = false } = await this.sendGetRequest(url);
    if (error || !entity) {
      const errorMessage = error?.error || error || 'Verification failed';
      throw new BadRequestException(errorMessage);
    }

    return {
      status: 'successful',
      message: 'Verification completed successfully',
      data: entity ?? null,
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

  async verifyDriversLicense(number: string, ) {
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

  async internationalPassport(number: string, ) {
    if (!/^[a-zA-Z]{3}([ -]{1})?[A-Z0-9]{6,12}$/i.test(number))
      throw new BadRequestException(
        'Verification failed, invalid passport number',
      );
    const url = '/kyc/passport?passport_number=' + number;
    const { entity = false, error = false } = await this.sendGetRequest(url);
    if (error || !entity) throw new BadRequestException('Verification failed');



    return {
      status: 'successful',
      message: 'Verification completed successfully',
      data: entity ?? null,
    };
  }

  async verifyDocumentImage(imageUrl: string,) {
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
      default:
    }
  }

  private async sendGetRequest(path: string) {
    const url = this.baseUrl + path;
    const httpService = new APIRequest({
      headers: this.headers,
    });

    return httpService.get(url);
  }

  private async sendPostRequest(path: string, body?: any) {
    const url = this.baseUrl + path;
    const httpService = new APIRequest({
      headers: this.headers,
    });

    return httpService.post(url, body);
  }
}
