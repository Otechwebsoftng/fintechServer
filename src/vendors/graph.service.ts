import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
    const res = await this.post('/person', payload);
    return res.data;
  }

  async updatePerson(personId: string, payload: any) {
    const res = await this.patch(`/person/${personId}`, payload);
    return res.data;
  }

  /* ===============================
     VIRTUAL ACCOUNTS
  =============================== */

  async createVirtualAccount(personId: string, currency: string) {
    const payload = {
      person_id: personId,
      label: 'Individual Virtual Account',
      currency,
    };

    this.logger.log(`Creating ${currency} virtual account`);

    const res = await this.post('/bank_account', payload);
    return res.data;
  }

  async getVirtualAccount(accountId: string) {
    const res = await this.get(`/bank_account/${accountId}`);
    return res;
  }

  async payoutDestination(payload: any) {
    const res = await this.post('/payout-destination', payload);
    return res.data;
  }

  async payout(payload: any) {
    const res = await this.post('/payout', payload);
    return res.data;
  }

  async mockFundVirtualAccount(payload: any) {
    const res = await this.post('/deposit/mock', payload);
    return res;
  }

  async fetchRates() {
    const res = await this.get('/rate');
    return res;
  }

  async listBank() {
    const res = await this.get('/bank');
    return res.data;
  }

  async resolveBank(payload: any) {
    try {
      const res = await this.post('/bank/resolve/account', payload);
      return res.data;
    } catch (error) {
      this.logger.error('Bank resolution failed', error);
      throw new BadRequestException('Could not verify bank account details');
    }
  }

  private http() {
    return new APIRequest({ headers: this.headers, timeout: 30000 });
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
