import {
  amountKeyFromRow,
  buildStableRowKey,
  normalizeExternalId,
} from '@app/modules/statement-import/statement-row-utils';
import type { ParsedStatementRow } from '@app/modules/statement-import/statement-import.types';

describe('statement-row-utils', () => {
  const baseRow = (over: Partial<ParsedStatementRow>): ParsedStatementRow => ({
    occurredAt: '2025-01-01',
    amount: 10,
    amountSign: -1,
    description: 'Test',
    ...over,
  });

  it('amountKeyFromRow uses sign', () => {
    expect(amountKeyFromRow(baseRow({ amount: 10, amountSign: -1 }))).toBe(-1000);
    expect(amountKeyFromRow(baseRow({ amount: 10, amountSign: 1 }))).toBe(1000);
  });

  it('normalizeExternalId truncates long fitid via sha1 prefix', () => {
    const long = 'x'.repeat(300);
    const normalized = normalizeExternalId(long);
    expect(normalized).toMatch(/^sha1:/);
    expect(normalized!.length).toBeLessThanOrEqual(255);
    expect(normalized).toBe(normalizeExternalId(long));
  });

  it('buildStableRowKey includes fitid when present', () => {
    const key = buildStableRowKey(baseRow({ fitid: 'ABC', amountSign: -1 }));
    expect(key).toContain('ABC');
    expect(key).toContain('-10.00');
  });
});
