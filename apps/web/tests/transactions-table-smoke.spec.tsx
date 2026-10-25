import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransactionsTable, matchesColumnFilters } from '@features/transactions/TransactionsTable';
import type { Transaction } from '@features/transactions/useTransactions';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  occurredAt: '2025-01-15T12:00:00.000Z',
  accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  direction: 'expense',
  amount: '42.5',
  description: 'Almoço',
  source: 'web',
  category: { id: 'c', name: 'Mercado', type: 'expense' },
  account: { id: 'a', name: 'Carteira' },
  ...over,
});

// matchesColumnFilters passou a receber noCategory/noAccount + formatadores (antes vinham do
// useFormatter no componente). Stubs determinísticos para os testes da função pura.
const noCategory = '—';
const noAccount = '—';
const fmtCurrency = (v: number) => v.toString();
const fmtDate = (s: string | null | undefined) => {
  if (!s) return '';
  const d = new Date(s);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

const filtersOf = (over: Partial<Record<'date' | 'description' | 'amount', string> & { category: string[]; account: string[] }>) => ({
  date: '',
  description: '',
  category: [] as string[],
  account: [] as string[],
  amount: '',
  ...over,
});

describe('matchesColumnFilters', () => {
  it('filtra por descrição e montante', () => {
    const t = tx();
    expect(
      matchesColumnFilters(t, filtersOf({ description: 'almo', amount: '42' }), noCategory, noAccount, fmtCurrency, fmtDate),
    ).toBe(true);
  });

  it('exclui quando a categoria não coincide com nenhum token', () => {
    const t = tx();
    expect(
      matchesColumnFilters(t, filtersOf({ category: ['viagens'] }), noCategory, noAccount, fmtCurrency, fmtDate),
    ).toBe(false);
  });

  it('filtra por data e por conta', () => {
    const t = tx();
    expect(
      matchesColumnFilters(t, filtersOf({ date: '15' }), noCategory, noAccount, fmtCurrency, fmtDate),
    ).toBe(true);
    expect(
      matchesColumnFilters(t, filtersOf({ date: '99' }), noCategory, noAccount, fmtCurrency, fmtDate),
    ).toBe(false);
    expect(
      matchesColumnFilters(t, filtersOf({ account: ['Carteira'] }), noCategory, noAccount, fmtCurrency, fmtDate),
    ).toBe(true);
  });

  it('filtra por montante formatado', () => {
    const t = tx({ amount: '100' });
    expect(
      matchesColumnFilters(t, filtersOf({ amount: '100' }), noCategory, noAccount, fmtCurrency, fmtDate),
    ).toBe(true);
  });
});

describe('TransactionsTable', () => {
  it('lista transações e chama onEdit', () => {
    const rows = [tx(), tx({ id: '11111111-1111-4111-8111-111111111112', description: 'Outro' })];
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(<TransactionsTable transactions={rows} onEdit={onEdit} onDelete={onDelete} />);

    const editButtons = screen.getAllByRole('button', { name: /Editar lançamento/i });
    expect(editButtons.length).toBeGreaterThan(0);
    fireEvent.click(editButtons[0]!);
    expect(onEdit).toHaveBeenCalledWith(rows[0]);
  });
});
