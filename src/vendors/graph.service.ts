import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import axios, { AxiosInstance } from 'axios';
import { APIRequest } from 'src/helpers/http.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class GraphService {
  baseUrl: string;
  secretKey: string;
  headers: object;
  //   httpClient: AxiosInstance;
  private readonly logger = new Logger(GraphService.name);

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
  ) {
    this.baseUrl = this.configService.get<string>('GRAPH_BASE_URL');
    this.secretKey = this.configService.get<string>('GRAPH_SECRET_KEY');

    this.headers = {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }
  /**
   * Generating permanent NGN account for a customer
   */
  async createNGNPerson(payload: any) {
    try {
      const result = await this.sendPostRequest('/person', payload);
      return result.data;
    } catch (error) {
      throw new BadRequestException(`Failed to create person`);
    }
  }

  async createUSDPerson(payload: any) {
    try {
      const result = await this.sendPostRequest('/person', payload);
      return result.data;
    } catch (error) {
      throw new BadRequestException(`Failed to create person`);
    }
  }

  async createVirtualAccount(personGraphId: string) {
    // Prepare request payload for Graph API
    const user = await this.usersService.getOne({
      OR: [{ personIdNGN: personGraphId }, { personIdUSD: personGraphId }],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // TIER_1 creates NGN account, TIER_2 creates USD account
    // Users should have just 1 NGN and 1 USD account
    const currency = user.kycLevel === 'TIER_2' ? 'USD' : 'NGN';

    const requestPayload = {
      person_id:
        user.kycLevel === 'TIER_2' ? user.personIdUSD : user.personIdNGN,
      label: 'Individual Virtual Account',
      currency: currency,
    };

    try {
      const result = await this.sendPostRequest(
        '/bank_account',
        requestPayload,
      );

      return result.data;
    } catch (error) {
      throw new BadRequestException(`Failed to create virtual account`);
    }
  }

  private async sendGetRequest(path: string) {
    const url = this.baseUrl + path;
    const httpService = new APIRequest({
      headers: this.headers,
    });

    return httpService.get(url);
  }

  private async sendPostRequest(path?: string, body?: any) {
    const url = this.baseUrl + path;
    const httpService = new APIRequest({
      headers: this.headers,
    });

    return await httpService.post(url, body);
  }
}
