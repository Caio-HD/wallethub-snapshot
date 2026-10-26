import { parseMoney } from './debt-money.util.js';
import type { DebtInstallmentEntity } from '../../database/entities/debt-installment.entity.js';

export interface DebtDerivedTotals {
  outstanding: number;
  paidCount: number;
  skippedCount: number;
  pendingCount: number;
  nextDueDate: string | null;
  dueThisMonth: number;
  dueNext7Days: number;
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeDebtDerivedTotals(
  installments: Pick<DebtInstallmentEntity, 'status' | 'amount' | 'dueDate'>[],
  todayYmd: string,
): DebtDerivedTotals {
  const pending = installments.filter((i) => i.status === 'pending');
  const outstanding = pending.reduce((sum, i) => sum + parseMoney(i.amount), 0);
  const paidCount = installments.filter((i) => i.status === 'paid').length;
  const skippedCount = installments.filter((i) => i.status === 'skipped').length;
  const sortedPending = [...pending].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const nextDueDate = sortedPending[0]?.dueDate ?? null;
  const currentMonth = monthKey(todayYmd);
  const weekEnd = addDaysYmd(todayYmd, 7);

  const dueThisMonth = pending
    .filter((i) => monthKey(i.dueDate) === currentMonth)
    .reduce((sum, i) => sum + parseMoney(i.amount), 0);

  const dueNext7Days = pending
    .filter((i) => i.dueDate >= todayYmd && i.dueDate <= weekEnd)
    .reduce((sum, i) => sum + parseMoney(i.amount), 0);

  return {
    outstanding,
    paidCount,
    skippedCount,
    pendingCount: pending.length,
    nextDueDate,
    dueThisMonth,
    dueNext7Days,
  };
}

export function toDebtDetailResponse(
  debt: {
    id: string;
    name: string;
    creditor: string | null;
    status: string;
    principalAmount: string;
    installmentAmount: string;
    totalInstallments: number;
    startDate: string;
    categoryId: string;
    accountId: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  installments: DebtInstallmentEntity[],
  todayYmd: string,
) {
  const derived = computeDebtDerivedTotals(installments, todayYmd);
  return {
    ...debt,
    ...derived,
    outstanding: derived.outstanding.toFixed(2),
    dueThisMonth: derived.dueThisMonth.toFixed(2),
    dueNext7Days: derived.dueNext7Days.toFixed(2),
    progress: `${derived.paidCount}/${debt.totalInstallments}`,
  };
}
