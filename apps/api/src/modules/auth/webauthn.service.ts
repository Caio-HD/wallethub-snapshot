import { Injectable } from '@nestjs/common';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { ConfigService } from '@nestjs/config';
import type { Passkey } from '../../database/entities/user.entity.js';

@Injectable()
export class WebAuthnService {
  private readonly rpID: string;
  private readonly rpName = 'WalletHub';
  private readonly origin: string;

  constructor(private readonly configService: ConfigService) {
    this.rpID = this.configService.get<string>('auth.rpID') ?? 'localhost';
    this.origin = this.configService.get<string>('auth.origin') ?? 'http://localhost:5173';
  }

  async generateRegistrationOptions(
    userId: string,
    userName: string,
    existingPasskeys: Passkey[] = [],
  ) {
    return generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userID: Buffer.from(userId),
      userName: userName,
      attestationType: 'none',
      excludeCredentials: existingPasskeys.map((key) => ({
        id: key.credentialID,
        type: 'public-key' as const,
        transports: key.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });
  }

  async verifyRegistrationResponse(body: RegistrationResponseJSON, expectedChallenge: string) {
    const opts: VerifyRegistrationResponseOpts = {
      response: body,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    };
    return verifyRegistrationResponse(opts);
  }

  async generateAuthenticationOptions(existingPasskeys: Passkey[] = []) {
    return generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: existingPasskeys.map((key) => ({
        id: key.credentialID,
        type: 'public-key' as const,
        transports: key.transports as AuthenticatorTransportFuture[],
      })),
      userVerification: 'preferred',
    });
  }

  async verifyAuthenticationResponse(
    body: AuthenticationResponseJSON,
    expectedChallenge: string,
    credential: Passkey,
  ) {
    const opts: VerifyAuthenticationResponseOpts = {
      response: body,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      credential: {
        id: credential.credentialID,
        publicKey: Buffer.from(credential.credentialPublicKey, 'base64'),
        counter: credential.counter,
        transports: credential.transports as AuthenticatorTransportFuture[],
      },
    };
    return verifyAuthenticationResponse(opts);
  }
}
