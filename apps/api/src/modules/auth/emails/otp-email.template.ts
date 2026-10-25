import type { SupportedLanguage } from '../../../common/constants/languages.js';
import { OTP_EMAIL_STYLES as S } from './otp-email.styles.js';

export type OtpEmailContent = { html: string; text: string };

/** Função de tradução escopada às chaves `email.otp.*`. */
export type OtpEmailTranslateFn = (key: string) => string;

export interface BuildOtpEmailParams {
  lang: SupportedLanguage;
  otp: string;
  /** TTL já formatado por formatOtpTtl (ex.: "5 minutos"). */
  ttlLabel: string;
  logoUrl: string;
  t: OtpEmailTranslateFn;
}

/**
 * Gera o e-mail OTP (HTML + texto) — cartão claro sobre fundo escuro, preheader
 * oculto, código em monospace, suporte RTL para `ar`. Sem dependência de imagens
 * para a legibilidade do código.
 */
export function buildOtpEmail(params: BuildOtpEmailParams): OtpEmailContent {
  const { lang, otp, ttlLabel, logoUrl, t } = params;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const expires = t('expires').replace('{{ttl}}', ttlLabel);

  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${S.bodyOuter}">
  <div style="${S.preheader}">${t('preview')}</div>
  <div style="${S.wrapper}">
    <div style="${S.card}">
      <img src="${logoUrl}" alt="WalletHub" height="40" style="${S.logo}" />
      <h1 style="${S.heading}">${t('heading')}</h1>
      <p style="${S.body}">${t('body')}</p>
      <p style="${S.codeLabel}">${t('codeLabel')}</p>
      <div style="${S.otpBox}"><span style="${S.otpCode}">${otp}</span></div>
      <p style="${S.expires}">${expires}</p>
      <p style="${S.security}">${t('security')}</p>
      <p style="${S.footer}">${t('footer')}</p>
    </div>
  </div>
</body>
</html>`;

  const text = [
    t('heading'),
    '',
    t('body'),
    '',
    `${t('codeLabel')}: ${otp}`,
    expires,
    '',
    t('security'),
    '',
    t('footer'),
  ].join('\n');

  return { html, text };
}
