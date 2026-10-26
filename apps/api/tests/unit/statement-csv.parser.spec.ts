import { parseStatementCsv } from '../../src/modules/statement-import/statement-csv.parser';

describe('parseStatementCsv', () => {
  it('parses comma-separated ISO dates', () => {
    const csv = `2025-01-10,12.50,Almoço
2025-01-11,3,Bus`;
    const rows = parseStatementCsv(Buffer.from(csv, 'utf-8'));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      occurredAt: '2025-01-10',
      amount: 12.5,
      description: 'Almoço',
    });
    expect(rows[1].amount).toBe(3);
  });

  it('parses semicolon BR dates', () => {
    const csv = '15/03/2025;10,5;Teste';
    const rows = parseStatementCsv(Buffer.from(csv, 'utf-8'));
    expect(rows).toHaveLength(1);
    expect(rows[0].occurredAt).toBe('2025-03-15');
    expect(rows[0].amount).toBe(10.5);
  });

  it('dedupes identical rows', () => {
    const csv = `2025-02-01,5,x
2025-02-01,5,x`;
    const rows = parseStatementCsv(Buffer.from(csv, 'utf-8'));
    expect(rows).toHaveLength(1);
  });
});
