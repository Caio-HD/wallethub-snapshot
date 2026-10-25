import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Resend } from 'resend';
import { Twilio } from 'twilio';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import type { NotificationsConfig } from '@config/notifications.config';
import { resolveOtpLocale, formatOtpTtl } from '../emails/otp-email.i18n.js';
import { buildOtpEmail, type OtpEmailTranslateFn } from '../emails/otp-email.template.js';
import { buildOtpWhatsAppMessage } from '../emails/otp-whatsapp.template.js';
import { OtpChannelSettingsService } from './otp-channel-settings.service';

export interface OtpDeliveryOptions {
  lang?: string | null;
  /** Instância Evolution efetiva (resolvida pelo roteador a partir de settings/env). */
  instanceName?: string;
}

export interface IEmailProvider {
  sendOtp(to: string, otp: string, opts?: OtpDeliveryOptions): Promise<void>;
}

export interface ISmsProvider {
  sendOtp(to: string, otp: string, opts?: OtpDeliveryOptions): Promise<void>;
}

function applyOtpPlaceholders(template: string, otp: string, ttlMinutes: number): string {
  return template.replace(/\{\{otp\}\}/g, otp).replace(/\{\{ttlMinutes\}\}/g, String(ttlMinutes));
}

/** Mascara o destinatário para logs (evita PII completa). */
function maskRecipient(to: string): string {
  if (to.includes('@')) {
    const [user, domain] = to.split('@');
    return `${user.slice(0, 2)}***@${domain}`;
  }
  return `${to.slice(0, 4)}***${to.slice(-2)}`;
}

@Injectable()
export class ResendEmailProvider implements IEmailProvider {
  private resend?: Resend;
  private readonly logger = new Logger(ResendEmailProvider.name);

  constructor(
    private configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    const cfg = this.configService.get<NotificationsConfig>('notifications');
    if (cfg?.resendApiKey) {
      this.resend = new Resend(cfg.resendApiKey);
    }
  }

  private translator(lang: string): OtpEmailTranslateFn {
    return (key) => this.i18n.translate(`email.otp.${key}`, { lang });
  }

  async sendOtp(to: string, otp: string, opts?: OtpDeliveryOptions): Promise<void> {
    const cfg = this.configService.get<NotificationsConfig>('notifications');
    if (!this.resend || !cfg) {
      this.logger.warn(`Resend not configured — OTP not sent to ${maskRecipient(to)}`);
      throw new ServiceUnavailableException('Email provider not configured');
    }

    const lang = resolveOtpLocale(opts?.lang);
    let subject: string;
    let html: string;
    let text: string | undefined;

    if (cfg.useBuiltInOtpEmailTemplate) {
      const t = this.translator(lang);
      const ttlLabel = formatOtpTtl(cfg.otpTtlMinutes, lang);
      subject = t('subject');
      const built = buildOtpEmail({
        lang,
        otp,
        ttlLabel,
        logoUrl: `${cfg.frontendOrigin}/brand/logo-full.png`,
        t,
      });
      html = built.html;
      text = built.text;
    } else {
      subject = cfg.emailOtpSubject;
      html = applyOtpPlaceholders(cfg.emailOtpHtml, otp, cfg.otpTtlMinutes);
    }

    const { error } = await this.resend.emails.send({
      from: cfg.resendFrom,
      to,
      subject,
      html,
      text,
    });
    if (error) {
      this.logger.error(
        `Resend error sending OTP to ${maskRecipient(to)}: ${error.message} (${error.name})`,
      );
      throw new ServiceUnavailableException('Failed to send OTP email');
    }
  }
}

@Injectable()
export class TwilioSmsProvider implements ISmsProvider {
  private client?: Twilio;
  private readonly logger = new Logger(TwilioSmsProvider.name);

  constructor(private configService: ConfigService) {
    const cfg = this.configService.get<NotificationsConfig>('notifications');
    if (cfg?.twilioAccountSid && cfg.twilioAuthToken) {
      this.client = new Twilio(cfg.twilioAccountSid, cfg.twilioAuthToken);
    }
  }

  async sendOtp(to: string, otp: string, _opts?: OtpDeliveryOptions): Promise<void> {
    const cfg = this.configService.get<NotificationsConfig>('notifications');
    if (!this.client || !cfg?.twilioPhoneNumber) {
      this.logger.warn(`Twilio not configured — OTP not sent to ${maskRecipient(to)}`);
      throw new ServiceUnavailableException('SMS provider not configured');
    }

    const body = applyOtpPlaceholders(cfg.twilioOtpBody, otp, cfg.otpTtlMinutes);
    await this.client.messages.create({ body, from: cfg.twilioPhoneNumber, to });
  }
}

/**
 * Envia OTP por WhatsApp via instância Evolution.
 * Mesma interface dos demais providers; texto multi-linha i18n com código em *negrito*.
 * A decisão de habilitar/instância fica no roteador (PhoneOtpDeliveryService); aqui
 * só validamos a capability (API key) e a instância efetiva recebida em opts.
 */
@Injectable()
export class EvolutionWhatsAppOtpProvider implements ISmsProvider {
  private readonly logger = new Logger(EvolutionWhatsAppOtpProvider.name);

  constructor(
    private configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  async sendOtp(to: string, otp: string, opts?: OtpDeliveryOptions): Promise<void> {
    const cfg = this.configService.get<NotificationsConfig>('notifications');
    const instanceName = opts?.instanceName?.trim() || cfg?.evolutionOtpInstanceName || '';
    if (!cfg?.evolutionOtpCapable || !instanceName) {
      this.logger.warn(`Evolution OTP not configured — not sent to ${maskRecipient(to)}`);
      throw new ServiceUnavailableException('WhatsApp OTP provider not configured');
    }

    const lang = resolveOtpLocale(opts?.lang);
    const ttlLabel = formatOtpTtl(cfg.otpTtlMinutes, lang);
    const t: OtpEmailTranslateFn = (key) => this.i18n.translate(`email.otp.${key}`, { lang });
    const text = buildOtpWhatsAppMessage({ t, otp, ttlLabel });
    const number = to.replace(/\D/g, '');

    try {
      await axios.post(
        `${cfg.evolutionApiUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`,
        { number, text },
        { headers: { apikey: cfg.evolutionApiKey }, timeout: 30_000 },
      );
    } catch (error) {
      this.logger.error(`Evolution OTP send failed to ${maskRecipient(to)}`, error as Error);
      throw new ServiceUnavailableException('Failed to send WhatsApp OTP');
    }
  }
}

/**
 * Roteia a entrega de OTP por telefone. Preferência: WhatsApp/Evolution quando
 * habilitado (kill-switch runtime em platform_settings, ou atalho de DEV) →
 * Twilio (se configurado) → erro. A env é só capability; o liga/desliga é DB.
 * Erros são genéricos (anti-enumeration no fluxo de auth).
 */
@Injectable()
export class PhoneOtpDeliveryService {
  private readonly logger = new Logger(PhoneOtpDeliveryService.name);

  constructor(
    private configService: ConfigService,
    private readonly twilio: TwilioSmsProvider,
    private readonly evolution: EvolutionWhatsAppOtpProvider,
    private readonly otpSettings: OtpChannelSettingsService,
  ) {}

  async deliverOtp(phone: string, otp: string, opts?: OtpDeliveryOptions): Promise<void> {
    const cfg = this.configService.get<NotificationsConfig>('notifications');
    const twilioConfigured = Boolean(
      cfg?.twilioAccountSid && cfg?.twilioAuthToken && cfg?.twilioPhoneNumber,
    );

    const wa = await this.otpSettings.getWhatsApp();
    const instanceName = wa.instanceName || cfg?.evolutionOtpInstanceName || '';
    const evolutionCapable = Boolean(cfg?.evolutionOtpCapable && instanceName);
    const evolutionEnabled =
      evolutionCapable && (wa.enabled || Boolean(cfg?.evolutionOtpDevAutoEnabled));

    if (evolutionEnabled) {
      await this.evolution.sendOtp(phone, otp, { ...opts, instanceName });
      return;
    }
    if (twilioConfigured) {
      await this.twilio.sendOtp(phone, otp, opts);
      return;
    }

    this.logger.warn('Nenhum provider de OTP por telefone disponível');
    throw new ServiceUnavailableException('Phone OTP delivery not available');
  }
}
