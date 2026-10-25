import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verify } from 'otplib';
import * as qrcode from 'qrcode';

@Injectable()
export class MfaService {
  generateSecret(): string {
    return generateSecret();
  }

  async generateQrCode(email: string, secret: string): Promise<string> {
    const otpauth = generateURI({ label: email, issuer: 'WalletHub', secret });
    return await qrcode.toDataURL(otpauth);
  }

  async verifyToken(token: string, secret: string): Promise<boolean> {
    const result = await verify({ secret, token });
    return result.valid;
  }
}
