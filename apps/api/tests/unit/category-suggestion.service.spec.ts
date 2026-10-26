import { normalizeStatementDescription } from '@app/modules/categories/category-suggestion.service';

describe('normalizeStatementDescription', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(normalizeStatementDescription('Padaria São José — R$ 12')).toBe('padaria sao jose r 12');
  });

  it('returns empty for whitespace', () => {
    expect(normalizeStatementDescription('   ')).toBe('');
  });
});
