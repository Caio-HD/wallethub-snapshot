import { resolveOtpLocale, formatOtpTtl } from '../../src/modules/auth/emails/otp-email.i18n';

describe('resolveOtpLocale', () => {
  it('mantém idiomas suportados', () => {
    expect(resolveOtpLocale('en')).toBe('en');
    expect(resolveOtpLocale('ar')).toBe('ar');
  });

  it('normaliza sub-tags para o idioma base', () => {
    expect(resolveOtpLocale('pt-BR')).toBe('pt');
    expect(resolveOtpLocale('en-US')).toBe('en');
    expect(resolveOtpLocale('ES-mx')).toBe('es');
  });

  it('cai no fallback pt para desconhecido/ausente', () => {
    expect(resolveOtpLocale('xx-YY')).toBe('pt');
    expect(resolveOtpLocale(undefined)).toBe('pt');
    expect(resolveOtpLocale('')).toBe('pt');
  });
});

describe('formatOtpTtl', () => {
  it('minutos quando < 60', () => {
    expect(formatOtpTtl(5, 'pt')).toBe('5 minutos');
    expect(formatOtpTtl(1, 'pt')).toBe('1 minuto');
    expect(formatOtpTtl(5, 'en')).toBe('5 minutes');
  });

  it('colapsa horas exatas', () => {
    expect(formatOtpTtl(60, 'pt')).toBe('1 hora');
    expect(formatOtpTtl(120, 'en')).toBe('2 hours');
  });

  it('colapsa dias exatos (evita "1440 minutos")', () => {
    expect(formatOtpTtl(1440, 'pt')).toBe('1 dia');
    expect(formatOtpTtl(2880, 'es')).toBe('2 días');
  });

  it('idiomas sem espaço (zh/ja)', () => {
    expect(formatOtpTtl(5, 'zh')).toBe('5分钟');
    expect(formatOtpTtl(60, 'ja')).toBe('1時間');
  });

  it('normaliza o locale do TTL', () => {
    expect(formatOtpTtl(5, 'pt-BR')).toBe('5 minutos');
    expect(formatOtpTtl(5, 'xx')).toBe('5 minutos');
  });
});
