import { registerAs } from '@nestjs/config';

/**
 * Domínio VERIFICADO no Resend. O default anterior (`auth@wallethub.app`) apontava
 * para um domínio que nunca foi verificado na conta, então um RESEND_FROM ausente
 * degradava para um remetente que o Resend recusa com 403 — falha de envio que só
 * aparece como "não recebi o código", nunca como erro de configuração.
 *
 * Se o domínio do remetente mudar, ele precisa estar verificado no Resend ANTES do
 * deploy: aposentar um domínio lá derruba o login em produção na hora.
 */
export const DEFAULT_RESEND_FROM = 'WalletHub <noreply@example.dev>';
export const DEFAULT_EMAIL_OTP_SUBJECT = 'Seu código de verificação WalletHub';
export const DEFAULT_EMAIL_OTP_HTML =
  '<p>Seu código é: <strong>{{otp}}</strong>. Ele expira em {{ttlMinutes}} minutos.</p>';
export const DEFAULT_TWILIO_OTP_BODY = 'Seu código WalletHub é: {{otp}}';

export interface NotificationsConfig {
  resendApiKey: string;
  resendFrom: string;
  emailOtpSubject: string;
  emailOtpHtml: string;
  otpTtlMinutes: number;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  twilioOtpBody: string;
  /** Origem do frontend (para URLs absolutas no e-mail, ex.: logo). */
  frontendOrigin: string;
  /** Usa o template built-in i18n só quando EMAIL_OTP_HTML e EMAIL_OTP_SUBJECT estão vazios. */
  useBuiltInOtpEmailTemplate: boolean;
  /** Evolution para OTP via WhatsApp. */
  evolutionApiUrl: string;
  evolutionApiKey: string;
  /** Instância default (env); pode ser sobreposta em runtime via platform_settings. */
  evolutionOtpInstanceName: string;
  /** Capaz de enviar (tem API key). O liga/desliga é runtime (platform_settings). */
  evolutionOtpCapable: boolean;
  /** Atalho de DEV: liga o canal sem tocar no DB (nunca em produção). */
  evolutionOtpDevAutoEnabled: boolean;
}

export const notificationsConfig = registerAs('notifications', (): NotificationsConfig => {
  const customHtml = process.env.EMAIL_OTP_HTML?.trim();
  const customSubject = process.env.EMAIL_OTP_SUBJECT?.trim();
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const evolutionApiKey = process.env.EVOLUTION_API_KEY?.trim() ?? '';
  const evolutionOtpInstanceName =
    process.env.EVOLUTION_OTP_INSTANCE_NAME?.trim() ||
    process.env.EVOLUTION_DEV_INSTANCE_NAME?.trim() ||
    '';

  return {
    resendApiKey: process.env.RESEND_API_KEY?.trim() ?? '',
    resendFrom: process.env.RESEND_FROM?.trim() || DEFAULT_RESEND_FROM,
    emailOtpSubject: customSubject || DEFAULT_EMAIL_OTP_SUBJECT,
    emailOtpHtml: customHtml || DEFAULT_EMAIL_OTP_HTML,
    otpTtlMinutes: Math.max(1, parseInt(process.env.EMAIL_OTP_TTL_MINUTES ?? '5', 10) || 5),
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID?.trim() ?? '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN?.trim() ?? '',
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER?.trim() ?? '',
    twilioOtpBody: process.env.TWILIO_OTP_BODY?.trim() || DEFAULT_TWILIO_OTP_BODY,
    frontendOrigin:
      process.env.FRONTEND_URL?.split(',')[0]?.trim().replace(/\/$/, '') ||
      'https://wallethub.example.com',
    useBuiltInOtpEmailTemplate: !customHtml && !customSubject,
    evolutionApiUrl: process.env.EVOLUTION_API_URL?.trim() || 'https://wallethub.example.com',
    evolutionApiKey,
    evolutionOtpInstanceName,
    evolutionOtpCapable: Boolean(evolutionApiKey),
    evolutionOtpDevAutoEnabled:
      nodeEnv !== 'production' &&
      process.env.EVOLUTION_OTP_DEV_ENABLED === 'true' &&
      Boolean(evolutionApiKey) &&
      Boolean(evolutionOtpInstanceName),
  };
});
