import { describe, expect, it } from 'vitest';
import {
  transactionBodyFromFormValues,
  transferBodyFromFormValues,
} from '@features/transactions/transaction-api-payload';

describe('transactionBodyFromFormValues', () => {
  it('mapeia campos e normaliza descrição vazia', () => {
    expect(
      transactionBodyFromFormValues({
        occurredAt: '2025-01-01',
        accountId: 'a',
        categoryId: 'c',
        direction: 'expense',
        amount: 12.5,
        description: '  x  ',
      }),
    ).toEqual({
      occurredAt: '2025-01-01',
      accountId: 'a',
      categoryId: 'c',
      amount: 12.5,
      description: 'x',
    });
  });

  it('usa string vazia quando a descrição é só espaços', () => {
    expect(
      transactionBodyFromFormValues({
        occurredAt: '2025-01-01',
        accountId: 'a',
        categoryId: 'c',
        direction: 'income',
        amount: 1,
        description: '   ',
      }).description,
    ).toBe('');
  });
});

describe('transferBodyFromFormValues', () => {
  it('mapeia conta de origem/destino e omite descrição vazia', () => {
    expect(
      transferBodyFromFormValues({
        occurredAt: '2025-02-02',
        accountId: 'from-acc',
        toAccountId: 'to-acc',
        direction: 'transfer',
        amount: 250,
        description: '  ',
      }),
    ).toEqual({
      occurredAt: '2025-02-02',
      amount: 250,
      fromAccountId: 'from-acc',
      toAccountId: 'to-acc',
      description: undefined,
    });
  });

  it('preserva a descrição quando informada', () => {
    expect(
      transferBodyFromFormValues({
        occurredAt: '2025-02-02',
        accountId: 'from-acc',
        toAccountId: 'to-acc',
        direction: 'transfer',
        amount: 100,
        description: 'Aplicação RDB',
      }).description,
    ).toBe('Aplicação RDB');
  });
});
