import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  public static readonly TOKEN_AUDIENCE = 'jwt.audience';

  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKey: configService.getOrThrow<string>('jwt.publicKey'),
      issuer: configService.get<string>('jwt.issuer') ?? undefined,
      audience: configService.get<string>(JwtStrategy.TOKEN_AUDIENCE) ?? undefined,
    });
  }

  validate(payload: JwtAccessPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email ?? null,
      role: payload.role as AuthenticatedUser['role'],
      isMfaEnabled: payload.isMfaEnabled ?? false,
    };
  }
}

export interface JwtAccessPayload {
  sub: string;
  email?: string;
  role: string;
  isMfaEnabled?: boolean;
}
