import {
  buildInstallmentSchedule,
  computeInstallmentBaseAmount,
} from '@app/modules/debts/debt-schedule.service';

describe('buildInstallmentSchedule', () => {
  it('generates n installments summing to principal', () => {
    const rows = buildInstallmentSchedule({
      principalAmount: 1000,
      totalInstallments: 3,
      startDate: '2026-01-31',
    });
    expect(rows).toHaveLength(3);
    const sum = rows.reduce((acc, r) => acc + Number.parseFloat(r.amount), 0);
    expect(sum).toBeCloseTo(1000, 2);
    expect(rows[2]?.dueDate).toBe('2026-03-31');
  });

  it('puts rounding remainder on last installment', () => {
    const rows = buildInstallmentSchedule({
      principalAmount: 1000,
      installmentAmount: 333.33,
      totalInstallments: 3,
      startDate: '2026-01-10',
    });
    expect(rows[0]?.amount).toBe('333.33');
    expect(rows[1]?.amount).toBe('333.33');
    expect(rows[2]?.amount).toBe('333.34');
  });

  it('computeInstallmentBaseAmount floors evenly', () => {
    expect(computeInstallmentBaseAmount(1000, 3)).toBe('333.33');
  });
});
