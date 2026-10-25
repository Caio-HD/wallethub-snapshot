import { normalizeBankField } from '../../src/modules/accounts/accounts.service';

describe('normalizeBankField', () => {
  it('retorna null para vazio/nulo', () => {
    expect(normalizeBankField(null)).toBeNull();
    expect(normalizeBankField(undefined)).toBeNull();
    expect(normalizeBankField('')).toBeNull();
    expect(normalizeBankField('  -- ')).toBeNull();
  });

  it('remove não-alfanuméricos e maiúsculas', () => {
    expect(normalizeBankField('12345-6')).toBe('123456');
    expect(normalizeBankField(' ab-12 ')).toBe('AB12');
  });

  it('remove zeros à esquerda (OFX vs digitado casam)', () => {
    expect(normalizeBankField('00056789')).toBe('56789');
    expect(normalizeBankField('0001234-5')).toBe('12345');
    // mesma forma canônica que a versão sem zeros à esquerda
    expect(normalizeBankField('0001234-5')).toBe(normalizeBankField('1234-5'));
  });

  it('preserva "0" quando o valor é só zeros', () => {
    expect(normalizeBankField('0000')).toBe('0');
  });
});
