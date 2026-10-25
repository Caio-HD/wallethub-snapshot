import { classifyStatementRow } from '@app/modules/statement-import/statement-import-classify';

describe('classifyStatementRow', () => {
  it('Aplicação RDB (saída) → investimento buy', () => {
    expect(classifyStatementRow({ description: 'Aplicação RDB', amountSign: -1 })).toEqual({
      kind: 'investment',
      movement: 'buy',
    });
  });

  it('Resgate RDB (entrada) → investimento sell', () => {
    expect(classifyStatementRow({ description: 'Resgate RDB', amountSign: 1 })).toEqual({
      kind: 'investment',
      movement: 'sell',
    });
  });

  it('Pagamento de fatura (saída) → despesa normal (cartão não é conta rastreada)', () => {
    expect(
      classifyStatementRow({ description: 'Pagamento de fatura', amountSign: -1 }),
    ).toEqual({ kind: 'normal' });
  });

  it('Pix enviado a pessoa → normal (gasto real, não reclassifica)', () => {
    expect(
      classifyStatementRow({
        description: 'Transferência enviada pelo Pix - João da Silva',
        amountSign: -1,
      }),
    ).toEqual({ kind: 'normal' });
  });

  it('Pix recebido → normal (renda real)', () => {
    expect(
      classifyStatementRow({
        description: 'Transferência recebida pelo Pix - Maria',
        amountSign: 1,
      }),
    ).toEqual({ kind: 'normal' });
  });

  it('não classifica RDB com sinal incoerente (aplicação que entra) → normal', () => {
    // Aplicação só é aporte quando o dinheiro SAI (amountSign < 0).
    expect(classifyStatementRow({ description: 'Aplicação RDB', amountSign: 1 })).toEqual({
      kind: 'normal',
    });
  });
});
