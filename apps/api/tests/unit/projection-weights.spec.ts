import { applyProjectionWeights, PROJECTION_WEIGHTS } from '@app/modules/projections/projection-weights';

describe('projection-weights', () => {
  it('aplica PROJECTION_WEIGHTS aos três valores', () => {
    expect(PROJECTION_WEIGHTS).toEqual([0.5, 0.3, 0.2]);
    expect(applyProjectionWeights([100, 100, 100])).toBe(100);
    expect(applyProjectionWeights([10, 20, 30])).toBe(Number((5 + 6 + 6).toFixed(2)));
  });
});
