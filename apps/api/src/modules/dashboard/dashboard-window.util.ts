import {
  parse,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  eachMonthOfInterval,
} from 'date-fns';
import type { DateRange } from '../../common/pipes/date-range.pipe.js';

export interface DateWindow {
  start: Date;
  end: Date;
}

/** Limite máximo de meses devolvidos pela timeline de evolução (protege intervalos enormes). */
const MAX_EVOLUTION_MONTHS = 24;

/** True quando o intervalo livre tem pelo menos uma data e deve sobrepor o período mensal. */
export function hasRange(range?: DateRange): range is DateRange {
  return !!range && (!!range.start || !!range.end);
}

/** Converte `yyyy-MM` (um ou vários separados por vírgula) em janelas de mês cheio. */
export function resolvePeriods(periodStr: string): DateWindow[] {
  return periodStr.split(',').map((p) => {
    const reference = parse(`${p.trim()}-01`, 'yyyy-MM-dd', new Date());
    return { start: startOfMonth(reference), end: endOfMonth(reference) };
  });
}

/**
 * Janela temporal de um relatório. Quando `range` traz pelo menos uma data usa o intervalo
 * livre por dia (sobrepõe o `period` mensal); caso contrário cai no comportamento mensal.
 */
export function resolveWindow(period: string, range?: DateRange): DateWindow[] {
  if (hasRange(range)) {
    const start = range.start ? startOfDay(range.start) : new Date(0);
    const end = endOfDay(range.end ?? new Date());
    return [{ start, end }];
  }
  return resolvePeriods(period);
}

/** Lista de datas-âncora (dia 1 de cada mês) para a timeline de evolução. */
export function resolveEvolutionMonths(months: number, range?: DateRange): Date[] {
  if (hasRange(range)) {
    const start = startOfMonth(range.start ?? range.end ?? new Date());
    const end = startOfMonth(range.end ?? new Date());
    return eachMonthOfInterval({ start, end }).slice(-MAX_EVOLUTION_MONTHS);
  }
  const now = new Date();
  const anchors: Date[] = [];
  for (let i = months - 1; i >= 0; i--) {
    anchors.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  return anchors;
}
