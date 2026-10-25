import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { normalizeEmail } from '../../common/utils/normalize-email.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../../database/entities/user.entity.js';
import { OrganizationEntity } from '../../database/entities/organization.entity.js';
import { OrganizationMembershipEntity } from '../../database/entities/organization-membership.entity.js';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokensDto } from './dto/tokens.dto';
import { RefreshTokenStore } from './refresh-token.store';
import { WebAuthnService } from './webauthn.service';
import { OtpService } from './otp.service';
import { MfaService } from './mfa.service';
import { RequestOtpDto, VerifyOtpDto, OtpType } from './dto/otp.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { ResendEmailProvider, PhoneOtpDeliveryService } from './providers/notification.providers';

export interface RefreshPayload {
  sub: string;
  email?: string | null;
  role: string;
  tokenId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokenStore: RefreshTokenStore,
    private readonly webAuthnService: WebAuthnService,
    private readonly otpService: OtpService,
    private readonly mfaService: MfaService,
    private readonly resendEmailProvider: ResendEmailProvider,
    private readonly phoneOtpDelivery: PhoneOtpDeliveryService,
    @InjectRepository(OrganizationEntity)
    private readonly organizationsRepository: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationMembershipEntity)
    private readonly membershipsRepository: Repository<OrganizationMembershipEntity>,
  ) {}

  async validateIdentifier(identifier: string): Promise<{
    exists: boolean;
    methods: string[];
    userId?: string;
    username?: string;
    name?: string;
  }> {
    const user = await this.resolveUserByIdentifier(identifier);

    if (!user) {
      return { exists: false, methods: [] };
    }

    const methods = ['password'];
    if (user.passkeys && user.passkeys.length > 0) {
      methods.push('passkey');
    }
    if (user.googleId || user.githubId) {
      methods.push('social');
    }
    if (user.emailVerified || user.phoneVerified) {
      methods.push('otp');
    }

    return {
      exists: true,
      methods,
      userId: user.id,
      username: user.username,
      name: user.name,
    };
  }

  private async resolveUserByIdentifier(identifier: string): Promise<UserEntity | null> {
    const trimmed = identifier.trim();
    const normalized = trimmed.toLowerCase();
    const candidates: UserEntity[] = [];

    const byEmail = await this.usersService.findByEmail(normalized);
    if (byEmail) candidates.push(byEmail);

    const byUsername = await this.usersService.findByUsername(normalized);
    if (byUsername && !candidates.some((c) => c.id === byUsername.id)) {
      candidates.push(byUsername);
    }

    const byPhone = await this.usersService.findByPhoneNumber(trimmed);
    if (byPhone && !candidates.some((c) => c.id === byPhone.id)) {
      candidates.push(byPhone);
    }

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    const active = candidates.filter((c) => c.isActive);
    if (active.length === 1) return active[0];
    if (active.length > 1) return active[0];
    return candidates[0];
  }

  async validateUser(username: string, password: string): Promise<UserEntity> {
    const user = await this.resolveUserByIdentifier(username);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    if (!user.isActive) {
      throw new UnauthorizedException(
        'Conta desactivada. Contacte o administrador ou utilize outro identificador.',
      );
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return user;
  }

  async login(dto: LoginDto): Promise<TokensDto> {
    const user = await this.validateUser(dto.username, dto.password);
    return this.issueSessionTokens(user);
  }

  /** Emite access + refresh tokens (mesmo caminho que login / refresh). */
  async issueSessionTokens(user: UserEntity): Promise<TokensDto> {
    return this.issueTokens(user);
  }

  async registerAndRequestOtp(dto: RegisterDto): Promise<{ success: true }> {
    const email = dto.email?.trim().toLowerCase();
    const phoneNumber = dto.phoneNumber?.trim();
    if (!email && !phoneNumber) {
      throw new BadRequestException('Email ou telefone é obrigatório');
    }

    if (email) {
      const existing = await this.usersService.findByEmail(email);
      if (existing) {
        if (!existing.emailVerified) {
          return this.requestOtp({ type: OtpType.EMAIL, identifier: email });
        }
        return { success: true };
      }
    }
    if (phoneNumber) {
      const existing = await this.usersService.findByPhoneNumber(phoneNumber);
      if (existing) {
        if (!existing.phoneVerified) {
          return this.requestOtp({ type: OtpType.PHONE, identifier: phoneNumber });
        }
        return { success: true };
      }
    }

    const user = await this.usersService.createPending({
      name: dto.name.trim(),
      email,
      phoneNumber,
    });
    await this.ensureDefaultOrganizationMembership(user.id);

    if (email) {
      return this.requestOtp({ type: OtpType.EMAIL, identifier: email });
    }
    return this.requestOtp({ type: OtpType.PHONE, identifier: phoneNumber! });
  }

  private async ensureDefaultOrganizationMembership(userId: string): Promise<void> {
    const organization = await this.organizationsRepository.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });
    if (!organization) {
      this.logger.warn('No organization found; skipping membership for new user');
      return;
    }
    await this.membershipsRepository.upsert(
      {
        organizationId: organization.id,
        userId,
        role: 'member',
        status: 'active',
        messagingAiEnabled: false,
      },
      ['organizationId', 'userId'],
    );
  }

  async requestOtp(dto: RequestOtpDto): Promise<{ success: true }> {
    if (dto.type === OtpType.EMAIL) {
      const email = dto.identifier.trim().toLowerCase();
      const user = await this.usersService.findByEmail(email);
      if (!user || !user.isActive) {
        throw new BadRequestException('Utilizador não encontrado');
      }
      const otp = await this.otpService.generateOtp(email);
      await this.resendEmailProvider.sendOtp(email, otp, { lang: user.preferredLanguage });
      return { success: true };
    }

    const user = await this.usersService.findByPhoneNumber(dto.identifier.trim());
    if (!user || !user.isActive) {
      throw new BadRequestException('Utilizador não encontrado');
    }
    if (!user.phoneNumber) {
      throw new BadRequestException('Telefone não associado à conta');
    }
    const otp = await this.otpService.generateOtp(user.phoneNumber);
    await this.phoneOtpDelivery.deliverOtp(user.phoneNumber, otp, { lang: user.preferredLanguage });
    return { success: true };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<TokensDto> {
    let otpKey: string;
    if (dto.type === OtpType.EMAIL) {
      otpKey = dto.identifier.trim().toLowerCase();
    } else {
      const user = await this.usersService.findByPhoneNumber(dto.identifier.trim());
      if (!user?.phoneNumber) {
        throw new UnauthorizedException('Código OTP inválido');
      }
      otpKey = user.phoneNumber;
    }

    const valid = await this.otpService.verifyOtp(otpKey, dto.code.trim());
    if (!valid) {
      throw new UnauthorizedException('Código OTP inválido');
    }

    const user =
      dto.type === OtpType.EMAIL
        ? await this.usersService.findByEmail(otpKey)
        : await this.usersService.findByPhoneNumber(dto.identifier.trim());
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilizador inválido');
    }

    if (dto.type === OtpType.EMAIL) {
      await this.usersService.markEmailVerified(user.id);
    } else {
      await this.usersService.markPhoneVerified(user.id);
    }

    return this.issueSessionTokens(user);
  }

  /**
   * Password reset step 1: send OTP to a verified contact. Always returns success to avoid
   * account enumeration.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: true }> {
    const user = await this.resolveUserByIdentifier(dto.identifier.trim());
    if (!user?.isActive) {
      return { success: true };
    }

    const channel = this.resolvePasswordResetChannel(user, dto.identifier.trim());
    if (!channel) {
      return { success: true };
    }

    if (channel.type === OtpType.EMAIL && user.email) {
      const otp = await this.otpService.generateOtp(user.email, 'password_reset');
      await this.resendEmailProvider.sendOtp(user.email, otp, { lang: user.preferredLanguage });
      return { success: true };
    }

    if (channel.type === OtpType.PHONE && user.phoneNumber) {
      const otp = await this.otpService.generateOtp(user.phoneNumber, 'password_reset');
      await this.phoneOtpDelivery.deliverOtp(user.phoneNumber, otp, {
        lang: user.preferredLanguage,
      });
    }

    return { success: true };
  }

  /** Password reset step 2: verify OTP and set a new password. */
  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    const user = await this.resolveUserByIdentifier(dto.identifier.trim());
    if (!user?.isActive) {
      throw new UnauthorizedException('Código inválido ou expirado');
    }

    const channel = this.resolvePasswordResetChannel(user, dto.identifier.trim());
    if (!channel) {
      throw new BadRequestException('Conta sem e-mail ou telefone verificado para redefinir senha');
    }

    const valid = await this.otpService.verifyOtp(
      channel.otpKey,
      dto.code.trim(),
      'password_reset',
    );
    if (!valid) {
      throw new UnauthorizedException('Código inválido ou expirado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.usersService.setPasswordHash(user.id, passwordHash);
    return { success: true };
  }

  private resolvePasswordResetChannel(
    user: UserEntity,
    identifier: string,
  ): { type: OtpType; otpKey: string; deliveryIdentifier: string } | null {
    const trimmed = identifier.trim();
    const normalizedEmail = trimmed.toLowerCase();

    if (trimmed.includes('@') && user.email && user.emailVerified) {
      if (user.email.toLowerCase() === normalizedEmail) {
        return { type: OtpType.EMAIL, otpKey: user.email, deliveryIdentifier: user.email };
      }
    }

    if (user.phoneNumber && user.phoneVerified) {
      const digits = trimmed.replace(/\D/g, '');
      const userDigits = user.phoneNumber.replace(/\D/g, '');
      if (trimmed === user.phoneNumber || (digits && userDigits.endsWith(digits))) {
        return {
          type: OtpType.PHONE,
          otpKey: user.phoneNumber,
          deliveryIdentifier: user.phoneNumber,
        };
      }
    }

    if (user.email && user.emailVerified) {
      return { type: OtpType.EMAIL, otpKey: user.email, deliveryIdentifier: user.email };
    }
    if (user.phoneNumber && user.phoneVerified) {
      return {
        type: OtpType.PHONE,
        otpKey: user.phoneNumber,
        deliveryIdentifier: user.phoneNumber,
      };
    }

    return null;
  }

  async refreshTokens(payload: RefreshPayload): Promise<TokensDto> {
    const cacheKey = this.getRefreshKey(payload.sub, payload.tokenId);
    const exists = await this.refreshTokenStore.has(cacheKey);
    if (!exists) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário inativo');
    }

    await this.refreshTokenStore.delete(cacheKey);
    return this.issueSessionTokens(user);
  }

  async logout(payload: RefreshPayload): Promise<void> {
    const cacheKey = this.getRefreshKey(payload.sub, payload.tokenId);
    await this.refreshTokenStore.delete(cacheKey);
  }

  /** Step 1: generate + persist a pending TOTP secret and return an enrollment QR code. */
  async startMfaEnrollment(userId: string): Promise<{ qrCode: string; secret: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    const secret = this.mfaService.generateSecret();
    await this.usersService.setMfaSecret(user.id, secret);
    const qrCode = await this.mfaService.generateQrCode(user.email ?? user.username, secret);
    return { qrCode, secret };
  }

  /**
   * Step 2: verify the first TOTP code, enable MFA, and re-issue tokens so the new access token
   * carries isMfaEnabled=true (the elevated-access gate reads it from the JWT).
   */
  async confirmMfaEnrollment(userId: string, token: string): Promise<TokensDto> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (!user.mfaSecret) throw new BadRequestException('Inscrição de MFA não iniciada');
    const valid = await this.mfaService.verifyToken(token, user.mfaSecret);
    if (!valid) throw new BadRequestException('Código MFA inválido');
    await this.usersService.enableMfa(user.id);
    user.isMfaEnabled = true;
    return this.issueSessionTokens(user);
  }

  private async issueTokens(user: UserEntity): Promise<TokensDto> {
    await this.usersService.ensureTwoAdmins();

    const tokenId = randomUUID();
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email ?? undefined,
      role: user.role,
      isMfaEnabled: user.isMfaEnabled,
    });

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email ?? undefined,
        role: user.role,
        tokenId,
      },
      {
        expiresIn: this.configService.get('jwt.refreshTokenTtl'),
      },
    );

    const ttlSeconds = this.parseDurationToSeconds(
      this.configService.get<string>('jwt.refreshTokenTtl') ?? '86400s',
    );

    await this.refreshTokenStore.store(this.getRefreshKey(user.id, tokenId), ttlSeconds);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseDurationToSeconds(
        this.configService.get<string>('jwt.accessTokenTtl') ?? '900s',
      ),
      tokenType: 'Bearer',
    };
  }

  private getRefreshKey(userId: string, tokenId: string): string {
    return `refresh:${userId}:${tokenId}`;
  }

  private parseDurationToSeconds(duration: string): number {
    if (/^\d+$/.test(duration)) {
      return parseInt(duration, 10);
    }

    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new BadRequestException('Duração inválida nas configurações de JWT');
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        this.logger.warn(`Unidade de duração desconhecida: ${unit}`);
        return value;
    }
  }

  /**
   * OAuth Google/GitHub: localiza ou cria utilizador e devolve entidade para emissão de tokens.
   */
  async validateSocialUser(params: {
    socialId: string;
    email: string;
    name: string;
    provider: 'google' | 'github' | 'facebook';
    emailVerified: boolean;
  }): Promise<UserEntity> {
    return this.usersService.findOrCreateSocialUser(params);
  }

  // ── F2: conectar/desconectar provedor social a uma conta logada ────────────

  /**
   * Token curto (10 min) carregado no `state` do OAuth para o fluxo "conectar
   * conta": prova que o popup foi iniciado pelo usuário logado `userId`.
   */
  async createSocialLinkState(userId: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId, purpose: 'social_link' }, { expiresIn: '10m' });
  }

  /** Valida o `state` do connect-flow; devolve o userId ou null (inválido/expirado). */
  async verifySocialLinkState(state: string): Promise<string | null> {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string; purpose?: string }>(state);
      if (payload?.purpose !== 'social_link' || !payload.sub) {
        return null;
      }
      return payload.sub;
    } catch {
      return null;
    }
  }

  async linkSocialToUser(
    userId: string,
    params: { provider: 'google' | 'github' | 'facebook'; socialId: string },
  ): Promise<UserEntity> {
    return this.usersService.linkSocialAccount(userId, params.provider, params.socialId);
  }

  /**
   * Decide o destino de um callback social: se houver `state` válido (popup
   * iniciado por usuário logado) → vincula a esse usuário; senão → login/criação
   * normal. `state` presente porém inválido/expirado é erro (não loga ninguém).
   */
  async resolveSocialAuth(
    state: string | undefined,
    params: {
      provider: 'google' | 'github' | 'facebook';
      socialId: string;
      email: string;
      name: string;
      emailVerified: boolean;
    },
  ): Promise<UserEntity> {
    if (state) {
      const linkUserId = await this.verifySocialLinkState(state);
      if (!linkUserId) {
        throw new UnauthorizedException('Pedido de vinculação inválido ou expirado.');
      }
      return this.linkSocialToUser(linkUserId, {
        provider: params.provider,
        socialId: params.socialId,
      });
    }
    return this.validateSocialUser(params);
  }

  async unlinkSocialFromUser(
    userId: string,
    provider: 'google' | 'github' | 'facebook',
  ): Promise<UserEntity> {
    return this.usersService.unlinkSocialAccount(userId, provider);
  }

  // ── F3b: troca de e-mail com confirmação por OTP no NOVO endereço ──────────

  /**
   * Solicita troca de e-mail: valida que o novo está livre e envia um OTP para
   * ELE. O e-mail atual segue válido até a confirmação. Não revela a outros se
   * um e-mail existe além do erro de conflito explícito (o usuário é o dono).
   */
  async requestEmailChange(userId: string, rawEmail: string): Promise<{ success: true }> {
    const newEmail = normalizeEmail(rawEmail);
    if (!newEmail) {
      throw new BadRequestException('E-mail inválido.');
    }
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }
    if (user.email && normalizeEmail(user.email) === newEmail) {
      throw new BadRequestException('Este já é o seu e-mail atual.');
    }
    const taken = await this.usersService.findByEmail(newEmail);
    if (taken && taken.id !== userId) {
      throw new ConflictException('Este e-mail já está em uso por outra conta.');
    }
    const otp = await this.otpService.generateOtp(newEmail, 'email_change');
    await this.resendEmailProvider.sendOtp(newEmail, otp, { lang: user.preferredLanguage });
    return { success: true };
  }

  /** Confirma a troca: valida o OTP enviado ao novo e-mail e efetiva a mudança. */
  async confirmEmailChange(userId: string, rawEmail: string, code: string): Promise<UserEntity> {
    const newEmail = normalizeEmail(rawEmail);
    if (!newEmail) {
      throw new BadRequestException('E-mail inválido.');
    }
    const valid = await this.otpService.verifyOtp(newEmail, code.trim(), 'email_change');
    if (!valid) {
      throw new UnauthorizedException('Código inválido ou expirado.');
    }
    // Re-checa disponibilidade (pode ter sido tomado entre pedido e confirmação).
    const taken = await this.usersService.findByEmail(newEmail);
    if (taken && taken.id !== userId) {
      throw new ConflictException('Este e-mail já está em uso por outra conta.');
    }
    return this.usersService.setVerifiedEmail(userId, newEmail);
  }
}
