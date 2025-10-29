import { HttpException, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

export class APIRequest {
  option: Record<string, unknown>;

  constructor(options: Record<string, unknown>) {
    this.option = Object.assign(
      { headers: { 'Content-Type': 'application/json' } },
      options,
    );
  }

  async get(url: string, params: Record<string, unknown> = {}) {
    this.option.params = params;
    try {
      const response = await axios.get(url, this.option);
      return response.data;
    } catch (err: any) {
      throw this.handleError(err);
    }
  }

  async post(url: string, body?: any) {
    try {
      const response = await axios.post(url, body, this.option);
      return response.data;
    } catch (err) {
      throw this.handleError(err);
    }
  }

  async trash(url: string) {
    try {
      const response = await axios.delete(url, this.option);
      return response.data;
    } catch (err) {
      throw this.handleError(err);
    }
  }

  handleError(err) {
    if (err.response) {
      const errorData = err.response.data.errors
        ? err.response.data.errors
        : err.response.data;
      console.log(errorData);
      throw new HttpException(err.response.statusText, err.response.status);
    } else if (err.request) {
      throw new InternalServerErrorException('Request failed');
    } else {
      throw new InternalServerErrorException(err.message);
    }
  }
}
