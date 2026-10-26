import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { RefreshPayload } from '../auth.service';
import { JwtStrategy } from './jwt.strategy';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      passReqToCallback: false,
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKey: configService.getOrThrow<string>('jwt.publicKey'),
      issuer: configService.get<string>('jwt.issuer') ?? undefined,
      audience: configService.get<string>(JwtStrategy.TOKEN_AUDIENCE) ?? undefined,
    });
  }

  validate(payload: RefreshPayload): RefreshPayload {
    return payload;
  }
}
