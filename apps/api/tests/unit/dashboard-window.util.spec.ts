import {
  resolvePeriods,
  resolveWindow,
  resolveEvolutionMonths,
  hasRange,
} from '../../src/modules/dashboard/dashboard-window.util';

describe('dashboard-window.util', () => {
  describe('hasRange', () => {
    it('é falso para undefined ou intervalo vazio', () => {
      expect(hasRange(undefined)).toBe(false);
      expect(hasRange({})).toBe(false);
    });

    it('é verdadeiro quando há ao menos uma data', () => {
      expect(hasRange({ start: new Date('2026-06-01') })).toBe(true);
      expect(hasRange({ end: new Date('2026-06-30') })).toBe(true);
    });
  });

  describe('resolvePeriods', () => {
    it('converte um mês em janela de mês cheio', () => {
      const [w] = resolvePeriods('2026-02');
      expect(w.start.getFullYear()).toBe(2026);
      expect(w.start.getMonth()).toBe(1); // fevereiro
      expect(w.start.getDate()).toBe(1);
      expect(w.end.getDate()).toBe(28); // 2026 não é bissexto
    });

    it('suporta múltiplos meses separados por vírgula', () => {
      const windows = resolvePeriods('2026-01, 2026-03');
      expect(windows).toHaveLength(2);
      expect(windows[0].start.getMonth()).toBe(0);
      expect(windows[1].start.getMonth()).toBe(2);
    });
  });

  describe('resolveWindow', () => {
    it('cai no modo mensal quando não há range', () => {
      const windows = resolveWindow('2026-02');
      expect(windows).toHaveLength(1);
      expect(windows[0].start.getMonth()).toBe(1);
      expect(windows[0].end.getDate()).toBe(28);
    });

    it('usa o intervalo livre por dia quando range é fornecido', () => {
      const windows = resolveWindow('2026-02', {
        start: new Date('2026-06-05'),
        end: new Date('2026-06-15'),
      });
      expect(windows).toHaveLength(1);
      expect(windows[0].start.getDate()).toBe(5);
      expect(windows[0].start.getHours()).toBe(0); // startOfDay
      expect(windows[0].end.getDate()).toBe(15);
      expect(windows[0].end.getHours()).toBe(23); // endOfDay — inclui o dia inteiro
    });

    it('range só com fim usa epoch como início', () => {
      const [w] = resolveWindow('2026-02', { end: new Date('2026-06-15') });
      expect(w.start.getTime()).toBe(0);
      expect(w.end.getDate()).toBe(15);
    });
  });

  describe('resolveEvolutionMonths', () => {
    it('devolve os últimos N meses quando não há range', () => {
      const anchors = resolveEvolutionMonths(6);
      expect(anchors).toHaveLength(6);
      // Cada âncora é o dia 1 do mês.
      anchors.forEach((d) => expect(d.getDate()).toBe(1));
    });

    it('deriva os meses que cobrem o intervalo', () => {
      const anchors = resolveEvolutionMonths(6, {
        start: new Date('2026-01-10'),
        end: new Date('2026-04-20'),
      });
      expect(anchors).toHaveLength(4); // jan, fev, mar, abr
      expect(anchors[0].getMonth()).toBe(0);
      expect(anchors[3].getMonth()).toBe(3);
    });

    it('limita a 24 meses para intervalos enormes', () => {
      const anchors = resolveEvolutionMonths(6, {
        start: new Date('2020-01-01'),
        end: new Date('2026-12-31'),
      });
      expect(anchors).toHaveLength(24);
    });
  });
});
