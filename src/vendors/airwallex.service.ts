import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface AirwallexAuthResponse {
  token: string;
  expires_at: string;
}

interface CreateBeneficiaryDto {
  bank_details: {
    account_currency: string;
    account_name: string;
    account_number: string;
    bank_country_code: string;
    bank_name?: string;
    swift_code?: string;
    local_clearing_system?: string;
    account_routing_type1?: string;
    account_routing_value1?: string;
  };
  payment_methods?: string[];
}

interface CreateTransferDto {
  request_id: string; // Idempotency key
  beneficiary_id?: string; // Use existing beneficiary
  beneficiary?: CreateBeneficiaryDto; // Or create new one inline
  source_currency: string;
  transfer_currency: string;
  transfer_amount: number;
  reason?: string;
  reference?: string;
}

@Injectable()
export class AirwallexService {
  private readonly logger = new Logger(AirwallexService.name);
  private httpClient: AxiosInstance;
  private baseUrl: string;
  private clientId: string;
  private apiKey: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('AIRWALLEX_BASE_URL');
    this.clientId = this.configService.get<string>('AIRWALLEX_CLIENT_ID');
    this.apiKey = this.configService.get<string>('AIRWALLEX_API_KEY');

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Authenticate with Airwallex and obtain access token
   */
  private async authenticate(): Promise<string> {
    // Check if token is still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await this.httpClient.post<AirwallexAuthResponse>(
        '/authentication/login',
        {},
        {
          headers: {
            'x-client-id': this.clientId,
            'x-api-key': this.apiKey,
          },
        },
      );

      this.accessToken = response.data.token;
      this.tokenExpiry = new Date(response.data.expires_at);

      this.logger.log('Successfully authenticated with Airwallex');
      return this.accessToken;
    } catch (error) {
      this.logger.error('Airwallex authentication failed', error.response?.data);
      throw new Error('Failed to authenticate with Airwallex');
    }
  }

  /**
   * Get current balance for all currencies
   */
  async getBalances() {
    const token = await this.authenticate();

    try {
      const response = await this.httpClient.get('/balances/current', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch Airwallex balances', error.response?.data);
      throw error;
    }
  }

  /**
   * Create a beneficiary for transfers
   */
  async createBeneficiary(beneficiaryData: CreateBeneficiaryDto) {
    const token = await this.authenticate();

    try {
      const response = await this.httpClient.post(
        '/beneficiaries/create',
        beneficiaryData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      this.logger.log(`Beneficiary created: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create beneficiary', error.response?.data);
      throw error;
    }
  }

  /**
   * Get list of beneficiaries
   */
  async getBeneficiaries(params?: { page_num?: number; page_size?: number }) {
    const token = await this.authenticate();

    try {
      const response = await this.httpClient.get('/beneficiaries', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch beneficiaries', error.response?.data);
      throw error;
    }
  }

  /**
   * Get a specific beneficiary by ID
   */
  async getBeneficiary(beneficiaryId: string) {
    const token = await this.authenticate();

    try {
      const response = await this.httpClient.get(`/beneficiaries/${beneficiaryId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch beneficiary ${beneficiaryId}`, error.response?.data);
      throw error;
    }
  }

  /**
   * Create a transfer (payout) to a beneficiary
   */
  async createTransfer(transferData: CreateTransferDto) {
    const token = await this.authenticate();

    try {
      const response = await this.httpClient.post(
        '/transfers/create',
        transferData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      this.logger.log(`Transfer created: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create transfer', error.response?.data);
      throw error;
    }
  }

  /**
   * Get transfer status
   */
  async getTransfer(transferId: string) {
    const token = await this.authenticate();

    try {
      const response = await this.httpClient.get(`/transfers/${transferId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch transfer ${transferId}`, error.response?.data);
      throw error;
    }
  }

  /**
   * Get list of transfers with optional filters
   */
  async getTransfers(params?: {
    page?: number;
    page_size?: number;
    status?: string;
    from_created_at?: string;
    to_created_at?: string;
  }) {
    const token = await this.authenticate();

    try {
      const response = await this.httpClient.get('/transfers', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch transfers', error.response?.data);
      throw error;
    }
  }

  /**
   * Get quote for FX conversion
   */
  async getQuote(params: {
    buy_currency: string;
    sell_currency: string;
    buy_amount?: number;
    sell_amount?: number;
  }) {
    const token = await this.authenticate();

    try {
      const response = await this.httpClient.post(
        '/fx/quotes/create',
        params,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get quote', error.response?.data);
      throw error;
    }
  }

  /**
   * Get Nigerian banks list
   */
  async getNigerianBanks() {
    const token = await this.authenticate();

    try {
      const response = await this.httpClient.post(
        '/beneficiary_api_schemas/generate',
        {
          bank_country_code: 'NG',
          payment_methods: ['LOCAL'],
          account_currency: 'NGN',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      // Extract bank list from schema
      const bankDetails = response.data?.bank_details;
      return bankDetails;
    } catch (error) {
      this.logger.error('Failed to fetch Nigerian banks', error.response?.data);
      throw error;
    }
  }
}
