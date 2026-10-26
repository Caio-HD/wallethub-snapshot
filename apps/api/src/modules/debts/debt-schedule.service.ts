import { addMonths, format, parseISO } from 'date-fns';
import { fromCents, money2, parseMoney, toCents } from './debt-money.util.js';

export interface InstallmentScheduleRow {
  sequenceNumber: number;
  dueDate: string;
  amount: string;
}

export function buildInstallmentSchedule(input: {
  principalAmount: number;
  installmentAmount?: number;
  totalInstallments: number;
  startDate: string;
}): InstallmentScheduleRow[] {
  const total = input.totalInstallments;
  if (total < 1) {
    throw new Error('totalInstallments must be >= 1');
  }
  if (input.principalAmount <= 0) {
    throw new Error('principalAmount must be positive');
  }

  const principalCents = toCents(input.principalAmount);
  const baseCents =
    input.installmentAmount != null
      ? toCents(input.installmentAmount)
      : Math.floor(principalCents / total);

  if (baseCents <= 0) {
    throw new Error('installment amount must be positive');
  }

  const rows: InstallmentScheduleRow[] = [];
  let allocated = 0;
  const start = parseISO(input.startDate);

  for (let seq = 1; seq < total; seq += 1) {
    allocated += baseCents;
    rows.push({
      sequenceNumber: seq,
      dueDate: format(addMonths(start, seq - 1), 'yyyy-MM-dd'),
      amount: fromCents(baseCents),
    });
  }

  const lastCents = principalCents - allocated;
  if (lastCents <= 0) {
    throw new Error('invalid schedule: last installment non-positive');
  }

  rows.push({
    sequenceNumber: total,
    dueDate: format(addMonths(start, total - 1), 'yyyy-MM-dd'),
    amount: fromCents(lastCents),
  });

  const sum = rows.reduce((acc, row) => acc + toCents(parseMoney(row.amount)), 0);
  if (sum !== principalCents) {
    throw new Error(`schedule sum mismatch: expected ${principalCents}, got ${sum}`);
  }

  return rows;
}

export function computeInstallmentBaseAmount(
  principalAmount: number,
  totalInstallments: number,
): string {
  return fromCents(Math.floor(toCents(principalAmount) / totalInstallments));
}

export { money2 };
