import { vectorLiteral } from '@app/modules/rag/rag-chunk.repository';

describe('vectorLiteral', () => {
  it('formats array for pgvector cast', () => {
    expect(vectorLiteral([1, 2, 3])).toBe('[1,2,3]');
    expect(vectorLiteral([0.1, -0.2])).toBe('[0.1,-0.2]');
  });
});
