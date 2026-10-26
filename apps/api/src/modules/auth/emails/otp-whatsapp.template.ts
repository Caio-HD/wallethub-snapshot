import type { OtpEmailTranslateFn } from './otp-email.template.js';

export interface BuildOtpWhatsAppParams {
  t: OtpEmailTranslateFn;
  otp: string;
  /** TTL já formatado por formatOtpTtl (ex.: "5 minutos"). */
  ttlLabel: string;
}

/**
 * Mensagem de OTP para WhatsApp, multi-linha e com o código em *negrito*
 * (sintaxe do WhatsApp). Reutiliza as mesmas chaves i18n do e-mail.
 */
export function buildOtpWhatsAppMessage(params: BuildOtpWhatsAppParams): string {
  const { t, otp, ttlLabel } = params;
  const expires = t('expires').replace('{{ttl}}', ttlLabel);
  return [
    'WalletHub',
    '',
    t('whatsappHeading'),
    '',
    t('whatsappBody'),
    '',
    `*${otp}*`,
    '',
    expires,
    '',
    t('security'),
  ].join('\n');
}
