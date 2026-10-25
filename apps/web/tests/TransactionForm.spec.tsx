import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Account } from '@features/transactions/useAccounts';
import type { Category } from '@features/transactions/useCategories';
import { TransactionForm } from '@features/transactions/TransactionForm';

const categories: Category[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Salário', type: 'income', ownerUserId: null, isActive: true },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Mercado', type: 'expense', ownerUserId: null, isActive: true },
];

const accounts: Account[] = [
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Carteira', ownerUserId: null, initialBalance: '0', isActive: true },
];

const twoAccounts: Account[] = [
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Conta A', ownerUserId: null, initialBalance: '0', isActive: true },
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Conta B', ownerUserId: null, initialBalance: '0', isActive: true },
];

describe('TransactionForm', () => {
  it('envia valores válidos', async () => {
    const handleSubmit = vi.fn();

    render(
      <TransactionForm
        categories={categories}
        accounts={accounts}
        onSubmit={handleSubmit}
        isSubmitting={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('DD/MM/AAAA'), { target: { value: '01/01/2025' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '120,50' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Almoço de domingo…'), {
      target: { value: 'Compra supermercado' },
    });

    const form = screen.getByRole('button', { name: /Salvar Lançamento/i }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => expect(handleSubmit).toHaveBeenCalled());
    const [payload] = handleSubmit.mock.calls[0] as [unknown];
    expect(payload).toMatchObject({
      occurredAt: '2025-01-01',
      amount: 120.5,
      description: 'Compra supermercado',
      categoryId: '22222222-2222-2222-2222-222222222222',
      accountId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    });
  });

  it('modo transferência envia direction=transfer com conta destino', async () => {
    const handleSubmit = vi.fn();

    render(
      <TransactionForm
        categories={categories}
        accounts={twoAccounts}
        onSubmit={handleSubmit}
        isSubmitting={false}
      />,
    );

    // entra no modo transferência
    fireEvent.click(screen.getByRole('button', { name: 'Transferência' }));

    fireEvent.change(screen.getByPlaceholderText('DD/MM/AAAA'), { target: { value: '02/02/2025' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '250,00' } });

    const form = screen.getByRole('button', { name: /Salvar Lançamento/i }).closest('form');
    fireEvent.submit(form!);

    await waitFor(() => expect(handleSubmit).toHaveBeenCalled());
    const [payload] = handleSubmit.mock.calls[0] as [Record<string, unknown>];
    expect(payload).toMatchObject({
      direction: 'transfer',
      amount: 250,
      accountId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      toAccountId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    });
  });

  it('bloqueia submit enquanto isSubmitting está ativo', () => {
    const handleSubmit = vi.fn();
    render(
      <TransactionForm
        categories={categories}
        accounts={accounts}
        onSubmit={handleSubmit}
        isSubmitting
      />,
    );

    expect(screen.getByText('Processando…')).toBeDisabled();
  });
});
