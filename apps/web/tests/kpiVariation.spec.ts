import { describe, expect, it } from 'vitest';
import { computeKpiVariations } from '@features/dashboard/kpiVariation';

describe('computeKpiVariations', () => {
  it('compara com a média dos 3 meses anteriores a P', () => {
    const evolution = [
      { period: '2024-10', totalIncome: 1000, totalExpense: 400, balance: 600, rowKind: 'actual' as const },
      { period: '2024-11', totalIncome: 1000, totalExpense: 400, balance: 600, rowKind: 'actual' as const },
      { period: '2024-12', totalIncome: 1000, totalExpense: 400, balance: 600, rowKind: 'actual' as const },
      { period: '2025-01', totalIncome: 1500, totalExpense: 700, balance: 800, rowKind: 'actual' as const },
    ];
    const r = computeKpiVariations(
      '2025-01',
      { totalIncome: 1500, totalExpense: 700, balance: 800 },
      evolution,
    );
    expect(r.incomePct).toBe(50);
    expect(r.expensePct).toBe(75);
    expect(r.balancePct).toBe(33.3);
  });

  it('devolve vazio se não há 3 meses anteriores', () => {
    const evolution = [
      { period: '2025-01', totalIncome: 100, totalExpense: 50, balance: 50, rowKind: 'actual' as const },
    ];
    const r = computeKpiVariations(
      '2025-01',
      { totalIncome: 100, totalExpense: 50, balance: 50 },
      evolution,
    );
    expect(r).toEqual({});
  });

  it('usa o mês mais antigo da lista quando há vários períodos', () => {
    const evolution = [
      { period: '2024-10', totalIncome: 1000, totalExpense: 400, balance: 600, rowKind: 'actual' as const },
      { period: '2024-11', totalIncome: 1000, totalExpense: 400, balance: 600, rowKind: 'actual' as const },
      { period: '2024-12', totalIncome: 1000, totalExpense: 400, balance: 600, rowKind: 'actual' as const },
      { period: '2025-02', totalIncome: 1500, totalExpense: 700, balance: 800, rowKind: 'actual' as const },
    ];
    const r = computeKpiVariations(
      '2025-03,2025-02',
      { totalIncome: 1500, totalExpense: 700, balance: 800 },
      evolution,
    );
    expect(r.incomePct).toBe(50);
    expect(r.expensePct).toBe(75);
    expect(r.balancePct).toBe(33.3);
  });

  it('omite percentagem quando média é zero', () => {
    const evolution = [
      { period: '2024-10', totalIncome: 0, totalExpense: 0, balance: 0, rowKind: 'actual' as const },
      { period: '2024-11', totalIncome: 0, totalExpense: 0, balance: 0, rowKind: 'actual' as const },
      { period: '2024-12', totalIncome: 0, totalExpense: 0, balance: 0, rowKind: 'actual' as const },
    ];
    const r = computeKpiVariations(
      '2025-01',
      { totalIncome: 100, totalExpense: 50, balance: 50 },
      evolution,
    );
    expect(r.incomePct).toBeUndefined();
    expect(r.expensePct).toBeUndefined();
    expect(r.balancePct).toBeUndefined();
  });
});
