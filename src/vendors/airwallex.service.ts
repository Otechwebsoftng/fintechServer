import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { APIRequest } from 'src/helpers/http.service';

@Injectable()
export class AirwallexService {
  baseUrl: string;
  publicKey: string;
  privateKey: string;
  appId: string;
  headers: object;
  clientId: string;
  apiKey: string;
  accessToken: string;
  tokenExpiry: Date;
  httpClient: AxiosInstance;
  private readonly logger = new Logger(AirwallexService.name);

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('AIRWALLEX_BASE_URL');
    this.clientId = this.configService.get<string>('AIRWALLEX_CLIENT_ID');
    this.apiKey = this.configService.get<string>('AIRWALLEX_API_KEY');
  }

  /**
   * Authenticate with Airwallex and obtain access token
   */

  //private
  async authenticate() {
    try {
      console.log('Authenticating with Airwallex...');

      if (
        this.accessToken &&
        this.tokenExpiry &&
        new Date() < this.tokenExpiry
      ) {
        return this.accessToken;
      }
      // const response = await this.sendPostRequest(
      //   '/authentication/login',
      //   {},
      //   {
      //     headers: {
      //       'x-client-id': this.clientId,
      //       'x-api-key': this.apiKey,
      //       'x-login-as': this.configService.get<string>('AIRWALLEX_ACCOUNT_ID'),
      //     },
      //   },
      // );

      const response = await axios.request({
        url: 'https://api-demo.airwallex.com/api/v1/authentication/login',
        method: 'post',
        headers: {
          'x-client-id': this.clientId,
          'x-api-key': this.apiKey,
          'x-login-as': this.configService.get<string>('AIRWALLEX_ACCOUNT_ID'),
        },
      });


      this.accessToken = response.data.token;
      this.tokenExpiry = new Date(response.data.expires_at);

      this.logger.log('Successfully authenticated with Airwallex');
      return this.accessToken;
    } catch (error) {
      this.logger.error('Airwallex authentication failed', error);
      this.logger.warn(
        'Continuing without Airwallex - set valid credentials to enable',
      );
      return null; // Return null instead of throwing
    }
  }

  private async sendGetRequest(path: string) {
    const url = this.baseUrl + path;
    const httpService = new APIRequest({
      headers: this.headers,
    });

    return httpService.get(url);
  }

  async sendPostRequest(
    path: string,
    body?: any,
    p0?: {
      headers: {
        'x-client-id': string;
        'x-api-key': string;
        'x-login-as': string;
      };
    },
  ) {
    const url = this.baseUrl + path;
    const httpService = new APIRequest({
      headers: this.headers,
    });

    return httpService.post(url, body);
  }

  /**
   * Verify payment intent status
   */
  async verifyPayment(paymentIntentId: string) {
    try {
      const token = await this.authenticate();

      if (!token) {
        throw new Error(
          'Airwallex authentication failed. Please check credentials.',
        );
      }

      const response = await axios.get(
        `${this.baseUrl}/pa/payment_intents/${paymentIntentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Payment verification successful for ${paymentIntentId}`);
      return {
        success: true,
        paymentIntentId: response.data.id,
        status: response.data.status,
        amount: response.data.amount,
        currency: response.data.currency,
        customer: response.data.customer_id,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
        data: response.data,
      };
    } catch (error) {
      this.logger.error(
        `Payment verification failed for ${paymentIntentId}`,
        error.response?.data,
      );
      throw new Error(
        `Failed to verify payment: ${error.response?.data?.message || error.message}`,
      );
    }
  }
}
