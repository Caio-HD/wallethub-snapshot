import { addMonths, format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const YYYY_MM = /^\d{4}-\d{2}$/;

/** Primeiro token `yyyy-MM` na string (não é necessariamente o mais antigo). */
export function primaryMonthFromPeriod(period: string): string {
  const raw = period.split(',')[0]?.trim() ?? '';
  if (YYYY_MM.test(raw)) return raw;
  return format(new Date(), 'yyyy-MM');
}

/** Menor mês `yyyy-MM` quando há vários separados por vírgula (para baseline de KPIs). */
export function earliestMonthFromPeriod(period: string): string {
  const parts = period
    .split(',')
    .map((p) => p.trim())
    .filter((p) => YYYY_MM.test(p))
    .sort();
  if (parts.length > 0) return parts[0];
  return primaryMonthFromPeriod(period);
}

/** Meses `yyyy-MM` válidos, ordenados. */
export function sortedYmMonthsFromPeriod(period: string): string[] {
  return period
    .split(',')
    .map((p) => p.trim())
    .filter((p) => YYYY_MM.test(p))
    .sort();
}

/** Rótulo curto para gráficos (um mês ou intervalo). */
export function chartPeriodLabel(period: string): string {
  const months = sortedYmMonthsFromPeriod(period);
  if (months.length === 0) {
    const p = primaryMonthFromPeriod(period);
    return format(parse(`${p}-01`, 'yyyy-MM-dd', new Date()), 'MMM/yy', { locale: ptBR });
  }
  if (months.length === 1) {
    return format(parse(`${months[0]}-01`, 'yyyy-MM-dd', new Date()), 'MMM/yy', {
      locale: ptBR,
    });
  }
  const a = months[0];
  const b = months[months.length - 1];
  const fa = format(parse(`${a}-01`, 'yyyy-MM-dd', new Date()), 'MMM/yy', { locale: ptBR });
  const fb = format(parse(`${b}-01`, 'yyyy-MM-dd', new Date()), 'MMM/yy', { locale: ptBR });
  return `${fa}–${fb}`;
}

export type PeriodShortcutKind =
  | 'current'
  | 'plus1'
  | 'plus3'
  | 'plus6'
  | 'minus1'
  | 'minus3'
  | 'minus6';

function startOfMonthFromYm(ym: string): Date {
  return parse(`${ym}-01`, 'yyyy-MM-dd', new Date());
}

/** Primeiro dia do mês `yyyy-MM` como string normalizada. */
export function ymFromDate(d: Date): string {
  return format(d, 'yyyy-MM');
}

/**
 * Valor de `period` (um ou vários `yyyy-MM`) para um atalho do PeriodPicker.
 * Âncora = primeiro mês válido em `anchorPeriod` ou mês civil corrente.
 */
export function periodFromShortcut(
  shortcut: PeriodShortcutKind,
  selectionMode: 'single' | 'multiple',
  anchorPeriod: string,
  todayYm: string,
): string {
  if (shortcut === 'current') return todayYm;

  const anchorYm = primaryMonthFromPeriod(anchorPeriod || todayYm);
  const A = startOfMonthFromYm(anchorYm);

  if (selectionMode === 'multiple') {
    switch (shortcut) {
      case 'plus1':
        return ymFromDate(addMonths(A, 1));
      case 'plus3':
        return [0, 1, 2].map((i) => ymFromDate(addMonths(A, i))).join(',');
      case 'plus6':
        return [0, 1, 2, 3, 4, 5].map((i) => ymFromDate(addMonths(A, i))).join(',');
      case 'minus1':
        return ymFromDate(addMonths(A, -1));
      case 'minus3':
        return [-2, -1, 0].map((i) => ymFromDate(addMonths(A, i))).join(',');
      case 'minus6':
        return [-5, -4, -3, -2, -1, 0].map((i) => ymFromDate(addMonths(A, i))).join(',');
      default:
        return todayYm;
    }
  }

  switch (shortcut) {
    case 'plus1':
      return ymFromDate(addMonths(A, 1));
    case 'plus3':
      return ymFromDate(addMonths(A, 2));
    case 'plus6':
      return ymFromDate(addMonths(A, 5));
    case 'minus1':
      return ymFromDate(addMonths(A, -1));
    case 'minus3':
      return ymFromDate(addMonths(A, -2));
    case 'minus6':
      return ymFromDate(addMonths(A, -5));
    default:
      return todayYm;
  }
}
