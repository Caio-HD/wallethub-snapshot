import { computeDebtDerivedTotals } from '@app/modules/debts/debt-derivatives.util';
import type { DebtInstallmentStatus } from '@app/database/entities/debt-installment.entity';

describe('computeDebtDerivedTotals', () => {
  const installments: Array<{
    status: DebtInstallmentStatus;
    amount: string;
    dueDate: string;
  }> = [
    { status: 'paid', amount: '100.00', dueDate: '2026-01-10' },
    { status: 'pending', amount: '100.00', dueDate: '2026-02-10' },
    { status: 'pending', amount: '50.00', dueDate: '2026-02-15' },
    { status: 'skipped', amount: '25.00', dueDate: '2026-03-10' },
  ];

  it('derives outstanding from pending only', () => {
    const derived = computeDebtDerivedTotals(installments, '2026-02-01');
    expect(derived.outstanding).toBe(150);
    expect(derived.paidCount).toBe(1);
    expect(derived.pendingCount).toBe(2);
    expect(derived.nextDueDate).toBe('2026-02-10');
  });

  it('computes due in month and next 7 days', () => {
    const derived = computeDebtDerivedTotals(installments, '2026-02-01');
    expect(derived.dueThisMonth).toBe(150);
    expect(derived.dueNext7Days).toBe(0);

    const nearDue = computeDebtDerivedTotals(installments, '2026-02-08');
    expect(nearDue.dueNext7Days).toBe(150);
  });
});
