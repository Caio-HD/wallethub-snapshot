import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DASHBOARD_EVOLUTION_SINGLE_ANCHOR_PAST_MONTHS,
  evolutionParamsFromDashboardPeriod,
} from '@features/dashboard/useDashboard';

describe('evolutionParamsFromDashboardPeriod', () => {
  it('um mês: âncora + N meses anteriores + future 0', () => {
    expect(evolutionParamsFromDashboardPeriod('2026-03')).toEqual({
      anchor: '2026-03',
      pastMonths: DASHBOARD_EVOLUTION_SINGLE_ANCHOR_PAST_MONTHS,
      futureMonths: 0,
    });
  });

  it('dois meses não consecutivos: periods ordenados', () => {
    expect(evolutionParamsFromDashboardPeriod('2026-12,2026-01')).toEqual({
      periods: ['2026-01', '2026-12'],
    });
  });

  it('três meses: periods ordenados cronologicamente', () => {
    expect(evolutionParamsFromDashboardPeriod('2025-06,2024-01,2025-01')).toEqual({
      periods: ['2024-01', '2025-01', '2025-06'],
    });
  });

  describe('sem tokens yyyy-MM válidos', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('usa primaryMonthFromPeriod → mês civil fixo (fallback) e mesma janela âncora', () => {
      expect(evolutionParamsFromDashboardPeriod('')).toEqual({
        anchor: '2026-06',
        pastMonths: DASHBOARD_EVOLUTION_SINGLE_ANCHOR_PAST_MONTHS,
        futureMonths: 0,
      });
      expect(evolutionParamsFromDashboardPeriod('foo,bar')).toEqual({
        anchor: '2026-06',
        pastMonths: DASHBOARD_EVOLUTION_SINGLE_ANCHOR_PAST_MONTHS,
        futureMonths: 0,
      });
    });
  });
});
