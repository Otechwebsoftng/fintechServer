import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APIRequest } from 'src/helpers/http.service';

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);
  private readonly baseUrl: string;
  private readonly headers: object;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('GRAPH_SECRET_KEY');

    this.baseUrl = this.configService.get<string>('GRAPH_BASE_URL');

    this.headers = {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  /* ===============================
     PERSON
  =============================== */

  async createPerson(payload: any) {
    try {
      const res = await this.post('/person', payload);
      return res.data;
    } catch (error) {
      this.logger.error('Create person failed', error);
      throw new BadRequestException('Failed to create person');
    }
  }

  async updatePerson(personId: string, payload: any) {
    try {
      const res = await this.patch(`/person/${personId}`, payload);
      return res.data;
    } catch (error) {
      this.logger.error('Update person failed', error);
      throw new BadRequestException('Failed to update person');
    }
  }

  /* ===============================
     VIRTUAL ACCOUNTS
  =============================== */

  async createVirtualAccount(personId: string, currency: string) {
    try {
      const payload = {
        person_id: personId,
        label: 'Individual Virtual Account',
        currency,
      };

      this.logger.log(`Creating ${currency} virtual account`);

      const res = await this.post('/bank_account', payload);
      return res.data;
    } catch (error) {
      this.logger.error('Virtual account creation failed', error);
      throw new BadRequestException('Failed to create virtual account');
    }
  }

  /* ===============================
     HTTP HELPERS
  =============================== */

  private http() {
    return new APIRequest({ headers: this.headers });
  }

  private async get(path: string) {
    return this.http().get(this.baseUrl + path);
  }

  private async post(path: string, body: any) {
    return this.http().post(this.baseUrl + path, body);
  }

  private async patch(path: string, body: any) {
    return this.http().patch(this.baseUrl + path, body);
  }

  private async put(path: string, body: any) {
    return this.http().put(this.baseUrl + path, body);
  }
}
