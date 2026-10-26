import type { EvolutionReportItem } from './useDashboard';
import { earliestMonthFromPeriod } from './periodUtils';

export interface KpiVariationResult {
  incomePct?: number;
  expensePct?: number;
  balancePct?: number;
}

/**
 * Compara totais do período atual com a média dos 3 meses calendário imediatamente anteriores a P
 * (P = mês mais antigo entre os selecionados). Percentagem: (atual - média) / média * 100 quando média > 0.
 * Caso contrário não devolve variação para essa métrica (UI mostra "Estável").
 */
export function computeKpiVariations(
  period: string,
  current: { totalIncome: number; totalExpense: number; balance: number },
  evolutionItems: EvolutionReportItem[],
): KpiVariationResult {
  const P = earliestMonthFromPeriod(period);
  const sorted = [...evolutionItems]
    .filter((it) => it.rowKind !== 'forecast')
    .sort((a, b) => a.period.localeCompare(b.period));
  const prior = sorted.filter((it) => it.period < P).slice(-3);
  if (prior.length === 0) {
    return {};
  }

  const n = prior.length;
  const avgIncome = prior.reduce((s, it) => s + it.totalIncome, 0) / n;
  const avgExpense = prior.reduce((s, it) => s + it.totalExpense, 0) / n;
  const avgBalance = prior.reduce((s, it) => s + it.balance, 0) / n;

  const pct = (actual: number, avg: number): number | undefined => {
    if (avg <= 0) return undefined;
    return Number((((actual - avg) / avg) * 100).toFixed(1));
  };

  return {
    incomePct: pct(current.totalIncome, avgIncome),
    expensePct: pct(current.totalExpense, avgExpense),
    balancePct: pct(current.balance, avgBalance),
  };
}
