import { describe, expect, it } from 'vitest';
import { computeAuditDiff } from '@features/platform/auditDiff';

describe('computeAuditDiff', () => {
  it('mostra apenas campos alterados quando há mudanças', () => {
    const rows = computeAuditDiff({ name: 'Antes', plan: 'free' }, { name: 'Depois', plan: 'free' });
    expect(rows).toHaveLength(2);
    const changed = rows.filter((r) => r.changed);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({ field: 'name', before: 'Antes', after: 'Depois' });
  });

  it('redige campos sensíveis', () => {
    const rows = computeAuditDiff(null, { password: 'secret123' });
    expect(rows[0].after).toBe('••••••••');
  });

  it('formata booleanos em português', () => {
    const rows = computeAuditDiff({ isActive: true }, { isActive: false });
    const active = rows.find((r) => r.field === 'isActive');
    expect(active?.before).toBe('sim');
    expect(active?.after).toBe('não');
  });
});
