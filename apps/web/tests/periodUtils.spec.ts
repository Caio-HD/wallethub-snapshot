import { describe, expect, it } from 'vitest';
import {
  chartPeriodLabel,
  earliestMonthFromPeriod,
  periodFromShortcut,
  primaryMonthFromPeriod,
  sortedYmMonthsFromPeriod,
} from '@features/dashboard/periodUtils';

describe('periodUtils', () => {
  it('primaryMonthFromPeriod usa o primeiro token yyyy-MM', () => {
    expect(primaryMonthFromPeriod('2025-03,2025-01')).toBe('2025-03');
  });

  it('earliestMonthFromPeriod escolhe o mês mais antigo', () => {
    expect(earliestMonthFromPeriod('2025-03,2025-01')).toBe('2025-01');
    expect(sortedYmMonthsFromPeriod('2025-03,2025-01')).toEqual(['2025-01', '2025-03']);
  });

  it('chartPeriodLabel resume um ou vários meses', () => {
    expect(chartPeriodLabel('2025-01')).toMatch(/jan/i);
    const multi = chartPeriodLabel('2025-01,2025-03');
    expect(multi).toContain('–');
  });

  describe('periodFromShortcut', () => {
    const todayUnused = '2000-01';

    it('current devolve todayYm', () => {
      expect(periodFromShortcut('current', 'single', '2025-06', '2026-03')).toBe('2026-03');
    });

    it('multiple: janelas forward a partir da âncora', () => {
      expect(periodFromShortcut('plus1', 'multiple', '2025-06', todayUnused)).toBe('2025-07');
      expect(periodFromShortcut('plus3', 'multiple', '2025-06', todayUnused)).toBe(
        '2025-06,2025-07,2025-08',
      );
      expect(periodFromShortcut('plus6', 'multiple', '2025-06', todayUnused)).toBe(
        '2025-06,2025-07,2025-08,2025-09,2025-10,2025-11',
      );
    });

    it('multiple: janelas backward terminando na âncora', () => {
      expect(periodFromShortcut('minus1', 'multiple', '2025-06', todayUnused)).toBe('2025-05');
      expect(periodFromShortcut('minus3', 'multiple', '2025-06', todayUnused)).toBe(
        '2025-04,2025-05,2025-06',
      );
      expect(periodFromShortcut('minus6', 'multiple', '2025-06', todayUnused)).toBe(
        '2025-01,2025-02,2025-03,2025-04,2025-05,2025-06',
      );
    });

    it('single: extremos das janelas e ±1', () => {
      expect(periodFromShortcut('plus1', 'single', '2025-06', todayUnused)).toBe('2025-07');
      expect(periodFromShortcut('plus3', 'single', '2025-06', todayUnused)).toBe('2025-08');
      expect(periodFromShortcut('plus6', 'single', '2025-06', todayUnused)).toBe('2025-11');
      expect(periodFromShortcut('minus1', 'single', '2025-06', todayUnused)).toBe('2025-05');
      expect(periodFromShortcut('minus3', 'single', '2025-06', todayUnused)).toBe('2025-04');
      expect(periodFromShortcut('minus6', 'single', '2025-06', todayUnused)).toBe('2025-01');
    });
  });
});
