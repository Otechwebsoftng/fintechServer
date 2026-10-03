import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APIRequest } from 'src/helpers/http.service';
import * as crypto from 'crypto';

@Injectable()
export class ObiexService {
  private readonly logger = new Logger(ObiexService.name);

  private readonly baseUrl: string;
  private apiKey: string;
  private secretKey: string;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('OBIEX_SECRET_KEY');
    this.apiKey = this.configService.get<string>('OBIEX_API_KEY');
    this.baseUrl = this.configService.get<string>('OBIEX_URL_STAGING');
  }

  async signRequest(
    method?: string,
    url?: string,
    // body?: any,
  ): Promise<{
    headers: Record<string, string>;
  }> {
    const timestamp = Date.now();
    const normalizedPath = url.startsWith('/') ? url : `/${url}`;

    // Include body in the signature when present (many providers require this)
    // const bodyString = body ? JSON.stringify(body) : '';
    const content =
      `${method.toUpperCase()}` +
      `${normalizedPath}` +
      // `${bodyString}` +
      `${timestamp}`;

    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(content)
      .digest('hex');

    return {
      headers: {
        'x-api-key': this.apiKey,
        'x-api-signature': expectedSignature,
        'x-api-timestamp': timestamp.toString(),
        'Content-Type': 'application/json',
      },
    };
  }

  async createDepositAddress(payload: {
    currency: string;
    network: string;
    uniqueUserIdentifier: string;
  }): Promise<any> {
    console.log('Creating deposit address with payload:', payload);
    const path = '/addresses/broker';
    const signedPath = `/v1${path}`;

    const { headers } = await this.signRequest('POST', signedPath);

    try {
      console.log({ path, payload, headers });
      const res = await this.post(path, payload, headers);
      this.logger.debug({
        message: `Obiex deposit address creation response`,
        obiexResult: res,
      });

      // APIRequest.post returns the response data; return it directly
      return res;
    } catch (error) {
      // Log more details from the provider to aid debugging
      console.log('Catching errors');

      throw new BadRequestException('Failed to create deposit address');
    }
  }

  private http(headers?: Record<string, string>) {
    return new APIRequest({
      headers: headers,
      timeout: 30000,
    });
  }

  private async get(path: string) {
    return this.http().get(this.baseUrl + path);
  }

  private async post(path: string, body: any, headers?: any) {
    return this.http(headers).post(`${this.baseUrl}${path}`, body);
  }

  private async patch(path: string, body: any, headers?: any) {
    return this.http(headers).patch(`${this.baseUrl}${path}`, body);
  }

  private async put(path: string, body: any, headers?: any) {
    return this.http(headers).put(`${this.baseUrl}${path}`, body);
  }
}
