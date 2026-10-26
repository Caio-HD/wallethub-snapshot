import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as GoogleStrategy, VerifyCallback } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as FacebookStrategy, Profile as FacebookProfile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService } from '../auth.service';

import { Profile as GoogleProfile } from 'passport-google-oauth20';
import { Profile as GitHubProfile } from 'passport-github2';

/** Lê o `state` (link-token do connect-flow F2) da query do callback. */
function readSocialState(req: Request): string | undefined {
  return typeof req.query?.state === 'string' ? req.query.state : undefined;
}

@Injectable()
export class GoogleOauthStrategy extends PassportStrategy(GoogleStrategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID')!,
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL')!,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: GoogleProfile,
    done: VerifyCallback,
  ): Promise<void> {
    const { id, emails, displayName } = profile;
    // Google (OIDC) entrega email_verified em _json — fonte confiável.
    const googleEmailVerified =
      (profile as unknown as { _json?: { email_verified?: boolean } })._json?.email_verified ===
      true;
    const user = await this.authService.resolveSocialAuth(readSocialState(req), {
      socialId: id,
      email: emails?.[0]?.value ?? '',
      name: displayName ?? '',
      provider: 'google',
      emailVerified: googleEmailVerified,
    });
    done(null, user);
  }
}

@Injectable()
export class GitHubOauthStrategy extends PassportStrategy(GitHubStrategy, 'github') {
  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID')!,
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('GITHUB_CALLBACK_URL')!,
      scope: ['user:email'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: GitHubProfile,
    done: (error: Error | null, user?: Express.User | false, info?: object) => void,
  ): Promise<void> {
    const { id, emails, displayName, username } = profile;
    const primaryEmail = emails?.[0]?.value;
    // GitHub só expõe e-mails verificados via scope user:email; quando a lib
    // traz o flag `verified`, exigimos true. Sem e-mail real ou sem flag →
    // tratamos como NÃO verificado (fail-safe: não auto-vincula).
    const githubEmailVerified =
      !!primaryEmail && (emails?.[0] as { verified?: boolean } | undefined)?.verified === true;
    const user = await this.authService.resolveSocialAuth(readSocialState(req), {
      socialId: id.toString(),
      email: primaryEmail || `${username ?? id}@github.com`,
      name: displayName || username || 'GitHub User',
      provider: 'github',
      emailVerified: githubEmailVerified,
    });
    done(null, user);
  }
}

/**
 * Meta (Facebook Login). Cobre tanto o botão "Facebook" quanto o "Instagram"
 * do frontend — o Instagram Basic Display foi descontinuado pela Meta e o
 * login de consumidor em apps de terceiros passa pelo Facebook Login.
 */
@Injectable()
export class FacebookOauthStrategy extends PassportStrategy(FacebookStrategy, 'facebook') {
  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('FACEBOOK_CLIENT_ID')!,
      clientSecret: configService.get<string>('FACEBOOK_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('FACEBOOK_CALLBACK_URL')!,
      scope: ['email', 'public_profile'],
      profileFields: ['id', 'emails', 'displayName'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: FacebookProfile,
    done: (error: Error | null, user?: Express.User | false, info?: object) => void,
  ): Promise<void> {
    const { id, emails, displayName } = profile;
    const primaryEmail = emails?.[0]?.value;
    // A Meta só devolve e-mails já verificados (não há e-mail não confirmado
    // numa conta Facebook); um e-mail real presente conta como verificado.
    const facebookEmailVerified = !!primaryEmail;
    const user = await this.authService.resolveSocialAuth(readSocialState(req), {
      socialId: id,
      email: primaryEmail || `${id}@facebook.com`,
      name: displayName || 'Facebook User',
      provider: 'facebook',
      emailVerified: facebookEmailVerified,
    });
    done(null, user);
  }
}
