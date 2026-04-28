// signature.service.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class SignatureService {
  private readonly secret = process.env.GRAPH_SIGNATURE_SECRET;

  verifySignature(payload: string, signature: string): boolean {
    const hash = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }
}
