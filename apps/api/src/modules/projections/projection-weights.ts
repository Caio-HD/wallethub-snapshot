/** Pesos para média ponderada dos 3 meses (mais recente → mais antigo). */
export const PROJECTION_WEIGHTS = [0.5, 0.3, 0.2] as const;

export function applyProjectionWeights(values: number[]): number {
  return Number(
    values
      .reduce((acc, value, index) => acc + value * (PROJECTION_WEIGHTS[index] ?? 0), 0)
      .toFixed(2),
  );
}
