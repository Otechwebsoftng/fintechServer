import { HttpException, InternalServerErrorException } from '@nestjs/common';
// import axios from 'axios';
import axios, { AxiosRequestConfig } from 'axios';

export class APIRequest {
  private readonly config: AxiosRequestConfig;

  constructor(options: AxiosRequestConfig) {
    this.config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
  }

  async get(url: string, params: Record<string, any> = {}) {
    try {
      // Pass this.config as the second argument
      const response = await axios.get(url, { ...this.config, params });
      return response.data;
    } catch (err) {
      throw this.handleError(err);
    }
  }

  async patch(url: string, body?: any) {
    try {
      const response = await axios.patch(url, body, this.config);
      return response.data;
    } catch (err) {
      throw this.handleError(err);
    }
  }

  async put(url: string, body?: any) {
    try {
      const response = await axios.put(url, body, this.config);
      return response.data;
    } catch (err) {
      throw this.handleError(err);
    }
  }

  async post(url: string, body?: any) {
    try {
      // Pass this.config as the third argument
      const response = await axios.post(url, body, this.config);
      return response.data;
    } catch (err) {
      throw this.handleError(err);
    }
  }

  async trash(url: string) {
    try {
      const response = await axios.delete(url, this.config);
      return response.data;
    } catch (err) {
      throw this.handleError(err);
    }
  }

  handleError(err) {
    if (err.response) {
      console.log(err)
      // The server responded with a status code (4xx, 5xx)
      const statusCode = err.response.status;
      const message = err.response.data?.message || err.response.statusText;

      // This allows your worker to see the REAL status (e.g., 400 for bad balance)
      throw new HttpException(message, statusCode);
    } else if (err.request) {
      // The request was made but no response was received (True Timeout)
      throw new HttpException('External Provider Timeout', 408);
    } else {
      // Something happened in setting up the request
      throw new InternalServerErrorException(err.message);
    }
  }
}
