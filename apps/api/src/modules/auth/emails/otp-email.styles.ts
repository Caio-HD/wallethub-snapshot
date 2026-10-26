/** Constantes de CSS inline reutilizáveis pelo template de e-mail OTP. */
export const OTP_EMAIL_STYLES = {
  bodyOuter: 'margin:0;padding:0;background:#0f172a;',
  wrapper: 'width:100%;background:#0f172a;padding:32px 0;',
  card:
    'max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:40px 32px;' +
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;",
  preheader:
    'display:none;font-size:1px;color:#0f172a;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;',
  logo: 'height:40px;width:auto;margin-bottom:24px;',
  heading: 'font-size:22px;font-weight:700;margin:0 0 12px;color:#0f172a;',
  body: 'font-size:15px;line-height:1.6;margin:0 0 24px;color:#334155;',
  codeLabel:
    'font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin:0 0 8px;',
  otpBox:
    'background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:18px 24px;text-align:center;margin:0 0 24px;',
  otpCode:
    "font-family:'SF Mono',Menlo,Monaco,'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:0.2em;color:#0f172a;",
  expires: 'font-size:14px;color:#334155;margin:0 0 24px;',
  security: 'font-size:13px;line-height:1.5;color:#64748b;margin:0 0 8px;',
  footer:
    'font-size:12px;color:#94a3b8;margin:24px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;',
} as const;
