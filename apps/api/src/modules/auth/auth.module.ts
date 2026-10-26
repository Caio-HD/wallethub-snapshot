import { Module, Type } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { RefreshTokenStore } from './refresh-token.store';
import { WebAuthnService } from './webauthn.service';
import { OtpService } from './otp.service';
import { MfaService } from './mfa.service';
import {
  GoogleOauthStrategy,
  GitHubOauthStrategy,
  FacebookOauthStrategy,
} from './strategies/social.strategies';
import {
  ResendEmailProvider,
  TwilioSmsProvider,
  EvolutionWhatsAppOtpProvider,
  PhoneOtpDeliveryService,
} from './providers/notification.providers';
import { OtpChannelSettingsService } from './providers/otp-channel-settings.service';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { OrganizationMembershipEntity } from '../../database/entities/organization-membership.entity';

type OauthStrategy = GoogleOauthStrategy | GitHubOauthStrategy | FacebookOauthStrategy;

function oauthStrategyProviders(): Type<OauthStrategy>[] {
  const out: Type<OauthStrategy>[] = [];
  if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CALLBACK_URL
  ) {
    out.push(GoogleOauthStrategy);
  }
  if (
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET &&
    process.env.GITHUB_CALLBACK_URL
  ) {
    out.push(GitHubOauthStrategy);
  }
  if (
    process.env.FACEBOOK_CLIENT_ID &&
    process.env.FACEBOOK_CLIENT_SECRET &&
    process.env.FACEBOOK_CALLBACK_URL
  ) {
    out.push(FacebookOauthStrategy);
  }
  return out;
}

@Module({
  imports: [
    PassportModule,
    UsersModule,
    PlatformSettingsModule,
    TypeOrmModule.forFeature([OrganizationEntity, OrganizationMembershipEntity]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        privateKey: configService.get<string>('jwt.privateKey'),
        publicKey: configService.get<string>('jwt.publicKey'),
        signOptions: {
          algorithm: 'RS256',
          issuer: configService.get('jwt.issuer'),
          audience: configService.get('jwt.audience'),
          expiresIn: configService.get('jwt.accessTokenTtl'),
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    RefreshTokenStore,
    WebAuthnService,
    OtpService,
    MfaService,
    ResendEmailProvider,
    TwilioSmsProvider,
    EvolutionWhatsAppOtpProvider,
    OtpChannelSettingsService,
    PhoneOtpDeliveryService,
    ...oauthStrategyProviders(),
  ],
  controllers: [AuthController],
  exports: [AuthService, WebAuthnService, OtpService, MfaService, OtpChannelSettingsService],
})
export class AuthModule {}
