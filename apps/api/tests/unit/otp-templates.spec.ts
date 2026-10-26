import { buildOtpEmail } from '../../src/modules/auth/emails/otp-email.template';
import { buildOtpWhatsAppMessage } from '../../src/modules/auth/emails/otp-whatsapp.template';

const PT: Record<string, string> = {
  subject: 'Seu código de verificação WalletHub',
  preview: 'Use este código para entrar com segurança.',
  heading: 'Verifique seu e-mail',
  body: 'Use o código abaixo para concluir seu acesso ao WalletHub.',
  codeLabel: 'Seu código',
  expires: 'Expira em {{ttl}}.',
  security: 'Se você não solicitou este código, ignore este e-mail. Nunca compartilhe seu código.',
  footer: 'WalletHub · suas finanças pessoais',
  whatsappHeading: 'Verifique seu número',
  whatsappBody: 'Use o código abaixo para concluir seu acesso ao WalletHub.',
};
const t = (k: string) => PT[k] ?? k;

describe('buildOtpEmail', () => {
  const out = buildOtpEmail({
    lang: 'pt',
    otp: '857771',
    ttlLabel: '5 minutos',
    logoUrl: 'https://wallethub.example.com/brand/logo-full.png',
    t,
  });

  it('inclui o código e o TTL formatado (sem placeholder cru)', () => {
    expect(out.html).toContain('857771');
    expect(out.html).toContain('Expira em 5 minutos.');
    expect(out.html).not.toContain('{{ttl}}');
    expect(out.text).toContain('857771');
    expect(out.text).toContain('Expira em 5 minutos.');
  });

  it('inclui preheader oculto e logo com alt', () => {
    expect(out.html).toContain('Use este código para entrar com segurança.');
    expect(out.html).toContain('alt="WalletHub"');
  });

  it('aplica dir=rtl para árabe', () => {
    const ar = buildOtpEmail({ lang: 'ar', otp: '1', ttlLabel: '5', logoUrl: 'x', t });
    expect(ar.html).toContain('dir="rtl"');
    expect(ar.html).toContain('lang="ar"');
  });
});

describe('buildOtpWhatsAppMessage', () => {
  it('código em *negrito* e multi-linha com TTL', () => {
    const msg = buildOtpWhatsAppMessage({ t, otp: '857771', ttlLabel: '5 minutos' });
    expect(msg).toContain('*857771*');
    expect(msg).toContain('Verifique seu número');
    expect(msg).toContain('Expira em 5 minutos.');
    expect(msg).not.toContain('{{ttl}}');
  });
});
