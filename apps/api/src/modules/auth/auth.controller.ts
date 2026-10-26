import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SocialAuthGuard } from './guards/social-auth.guard';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokensDto } from './dto/tokens.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RefreshPayload } from './decorators/refresh-payload.decorator';
import type { RefreshPayload as RefreshPayloadData } from './auth.service';
import { ValidateIdentifierDto } from './dto/validate-identifier.dto';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { MfaConfirmDto } from './dto/mfa-confirm.dto';
import { RequestEmailChangeDto, ConfirmEmailChangeDto } from './dto/change-email.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { UserEntity } from '../../database/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Throttle({ global: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<TokensDto> {
    return this.authService.login(dto);
  }

  @Post('validate-identifier')
  @HttpCode(HttpStatus.OK)
  validateIdentifier(@Body() dto: ValidateIdentifierDto) {
    return this.authService.validateIdentifier(dto.identifier);
  }

  @Throttle({ global: { limit: 3, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.OK)
  register(@Body() dto: RegisterDto): Promise<{ success: true }> {
    return this.authService.registerAndRequestOtp(dto);
  }

  @Throttle({ global: { limit: 5, ttl: 60000 } })
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() dto: RequestOtpDto): Promise<{ success: true }> {
    return this.authService.requestOtp(dto);
  }

  @Throttle({ global: { limit: 10, ttl: 60000 } })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<TokensDto> {
    return this.authService.verifyOtp(dto);
  }

  @Throttle({ global: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ success: true }> {
    return this.authService.forgotPassword(dto);
  }

  @Throttle({ global: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto): Promise<{ success: true }> {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  refresh(@RefreshPayload() payload: RefreshPayloadData): Promise<TokensDto> {
    return this.authService.refreshTokens(payload);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async logout(@RefreshPayload() payload: RefreshPayloadData): Promise<void> {
    await this.authService.logout(payload);
  }

  @Get('google')
  @UseGuards(SocialAuthGuard('google'))
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(SocialAuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const tokens = await this.authService.issueSessionTokens(req.user as UserEntity);
    this.sendSocialAuthResult(res, tokens);
  }

  @Get('github')
  @UseGuards(SocialAuthGuard('github'))
  githubAuth() {}

  @Get('github/callback')
  @UseGuards(SocialAuthGuard('github'))
  async githubCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const tokens = await this.authService.issueSessionTokens(req.user as UserEntity);
    this.sendSocialAuthResult(res, tokens);
  }

  @Get('facebook')
  @UseGuards(SocialAuthGuard('facebook'))
  facebookAuth() {}

  @Get('facebook/callback')
  @UseGuards(SocialAuthGuard('facebook'))
  async facebookCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const tokens = await this.authService.issueSessionTokens(req.user as UserEntity);
    this.sendSocialAuthResult(res, tokens);
  }

  // ── F2: conectar/desconectar provedor social (usuário logado) ──────────────

  /**
   * Gera o `state` (token curto) para o fluxo "conectar conta". O frontend abre
   * /auth/<provider>?state=<state> num popup; o callback vincula ao usuário.
   */
  @Post('social/link-token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async createSocialLinkToken(@CurrentUser() user: AuthenticatedUser): Promise<{ state: string }> {
    return { state: await this.authService.createSocialLinkState(user.id) };
  }

  @Delete('social/:provider')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async unlinkSocial(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provider') provider: string,
  ): Promise<{ linkedProviders: { google: boolean; github: boolean; facebook: boolean } }> {
    if (provider !== 'google' && provider !== 'github' && provider !== 'facebook') {
      throw new BadRequestException('Provedor inválido.');
    }
    const updated = await this.authService.unlinkSocialFromUser(user.id, provider);
    return {
      linkedProviders: {
        google: !!updated.googleId,
        github: !!updated.githubId,
        facebook: !!updated.facebookId,
      },
    };
  }

  // ── F3b: troca de e-mail com OTP no novo endereço ──────────────────────────

  @Post('email/change/request')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  requestEmailChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestEmailChangeDto,
  ): Promise<{ success: true }> {
    return this.authService.requestEmailChange(user.id, dto.newEmail);
  }

  @Post('email/change/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async confirmEmailChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmEmailChangeDto,
  ): Promise<{ email: string | null; emailVerified: boolean }> {
    const updated = await this.authService.confirmEmailChange(user.id, dto.newEmail, dto.code);
    return { email: updated.email ?? null, emailVerified: updated.emailVerified };
  }

  @Post('mfa/enroll/start')
  @UseGuards(JwtAuthGuard)
  startMfaEnrollment(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.startMfaEnrollment(user.id);
  }

  @Post('mfa/enroll/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  confirmMfaEnrollment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaConfirmDto,
  ): Promise<TokensDto> {
    return this.authService.confirmMfaEnrollment(user.id, dto.token);
  }

  private sendSocialAuthResult(res: Response, tokens: TokensDto): void {
    const origin =
      this.configService.get<string>('app.frontendUrl')?.split(',')[0].trim() ??
      'http://localhost:5173';
    const payload = JSON.stringify(tokens);
    // Nonce por resposta: o default do helmet emite CSP `script-src 'self'`, que
    // bloqueia o script inline abaixo (popup nunca faz postMessage nem fecha).
    // Sobrescreve a CSP apenas nesta resposta, liberando só este script.
    const nonce = randomBytes(16).toString('base64');
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'`);
    res.send(
      `<html><body><script nonce="${nonce}">window.opener?.postMessage({type:'SOCIAL_AUTH_SUCCESS',tokens:${payload}},'${origin}');window.close();</script></body></html>`,
    );
  }
}
