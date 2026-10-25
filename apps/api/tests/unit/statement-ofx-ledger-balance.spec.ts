import { parseStatementOFX } from '@app/modules/statement-import/statement-ofx.parser';
import { classifyStatementRow } from '@app/modules/statement-import/statement-import-classify';
import { buildOfx, stmtrn } from '../../test/support/ofx.fixture';

/**
 * Regressão do BUG-41: o parser ignorava o <LEDGERBAL> do OFX — o saldo que o
 * BANCO tinha no fechamento. Sem ele, uma conta que já tinha saldo antes da
 * primeira importação fica torta para sempre, e a abertura de saldo não tem
 * como ser calculada.
 *
 * Regressão do BUG-39: "Pagamento de fatura" era classificado como
 * transferência neutra, o que tirava ~R$ 2.400/mês dos totais de despesa.
 */

describe('parseStatementOFX (ledger balance)', () => {
  it('reads the closing balance the bank recorded in the statement', () => {
    const buf = buildOfx([
      stmtrn({
        dtposted: '20261001120000',
        trnamt: '-100.00',
        name: 'Aplicação RDB',
        fitid: 'f-1',
      }),
      stmtrn({ dtposted: '20261003120000', trnamt: '100.01', name: 'Resgate RDB', fitid: 'f-2' }),
    ]);

    const result = parseStatementOFX(buf);

    expect(result.ledgerBalance).toBeDefined();
    expect(result.ledgerBalance?.amount).toBeCloseTo(668.02, 2);
    expect(result.ledgerBalance?.dtasof).toBe('2026-10-19');
  });

  it('leaves ledgerBalance undefined when the statement has no LEDGERBAL', () => {
    const buf = buildOfx(
      [stmtrn({ dtposted: '20261001120000', trnamt: '-10.00', name: 'X', fitid: 'f-3' })],
      null,
    );

    expect(parseStatementOFX(buf).ledgerBalance).toBeUndefined();
  });

  it('still parses the rows when a balance is present', () => {
    const buf = buildOfx([
      stmtrn({
        dtposted: '20261001120000',
        trnamt: '-100.00',
        name: 'Aplicação RDB',
        fitid: 'f-4',
      }),
    ]);

    const result = parseStatementOFX(buf);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].amount).toBeCloseTo(100.0, 2);
    expect(result.rows[0].amountSign).toBe(-1);
  });
});

describe('classifyStatementRow (card payment)', () => {
  it('treats a card bill payment as a normal expense, not a neutral transfer', () => {
    const result = classifyStatementRow({
      description: 'Pagamento de fatura',
      amountSign: -1,
    });

    expect(result.kind).toBe('normal');
  });

  it('keeps RDB aporte and resgate routed to the investment path', () => {
    expect(classifyStatementRow({ description: 'Aplicação RDB', amountSign: -1 })).toEqual({
      kind: 'investment',
      movement: 'buy',
    });
    expect(classifyStatementRow({ description: 'Resgate RDB', amountSign: 1 })).toEqual({
      kind: 'investment',
      movement: 'sell',
    });
  });
});
