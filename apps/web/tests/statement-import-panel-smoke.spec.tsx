import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatementImportPanel } from '@features/transactions/StatementImportPanel';
import apiClient from '@shared/lib/apiClient';

vi.mock('@shared/context/ActiveOrganizationContext', () => ({
  useActiveOrganization: () => ({
    activeOrganizationId: '11111111-1111-4111-8111-111111111111',
    activeOrganization: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Test Org',
      plan: 'pro' as const,
    },
    isLoadingOrganizations: false,
    organizations: [],
    setActiveOrganizationId: vi.fn(),
    refreshOrganizations: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn() },
}));

const accounts = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Conta',
    balance: '0',
    lastBalanceUpdateAt: null,
    ownerUserIds: null,
    isActive: true,
  },
];

const categories = [
  {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    name: 'Geral',
    type: 'expense' as const,
    ownerUserId: null,
    isActive: true,
    sortOrder: 0,
  },
];

describe('StatementImportPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza upload e seletores', () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <StatementImportPanel accounts={accounts} categories={categories} />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Importar extrato/i)).toBeInTheDocument();
  });

  it('a selecção do ficheiro já pré-visualiza, e um único botão grava via /commit', async () => {
    const post = vi.spyOn(apiClient, 'post');
    post
      // preview auto-disparado pela selecção do ficheiro.
      .mockResolvedValueOnce({
        data: {
          previewRows: [
            {
              rowKey: 'r1',
              occurredAt: '2025-01-01',
              amount: 10,
              description: 'x',
              direction: 'expense',
              duplicateStatus: 'new',
              selectedByDefault: true,
              suggestedCategoryId: null,
              suggestionConfidence: 0,
            },
          ],
          rowCount: 1,
          filename: 't.csv',
          reconciliation: { exact: 0, likely: 0, new: 1 },
        },
      })
      // commit real (sem dryRun) ao clicar no botão único.
      .mockResolvedValueOnce({
        data: { created: 1, skipped: 0, alreadyExists: 0, dryRun: false, previewRows: [], errors: [] },
      });

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <StatementImportPanel accounts={accounts} categories={categories} />
      </QueryClientProvider>,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    // A própria selecção dispara a pré-visualização — sem botão "Pré-visualizar".
    fireEvent.change(input!, {
      target: { files: [new File(['2025-01-01,10,teste'], 't.csv', { type: 'text/csv' })] },
    });
    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        '/imports/statement/preview',
        expect.any(FormData),
        expect.any(Object),
      );
    });

    // Botão único "Importar N…" grava de verdade (sem "Simular gravação").
    fireEvent.click(await screen.findByRole('button', { name: /Importar/i }));
    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        '/imports/statement/commit',
        expect.any(FormData),
        expect.any(Object),
      );
    });
  });

  it('auto-cadastro do lote usa o endpoint dedicado ensure-account (não o /accounts público)', async () => {
    const post = vi.spyOn(apiClient, 'post');
    // preview-batch: um ficheiro com conta detectada mas ainda não cadastrada.
    post
      .mockResolvedValueOnce({
        data: {
          token: 'tok-1',
          files: [
            {
              filename: 'a.ofx',
              detectedAcctId: '257161786',
              rowCount: 1,
              detectedFormat: 'ofx',
              accountUnmatched: true,
              suggestedAccount: {
                name: 'Nubank',
                bankId: '260',
                bankName: 'Nubank',
                branchNumber: '1',
                accountNumber: '257161786',
              },
            },
          ],
          previewRows: [],
          reconciliation: { exact: 0, likely: 0, new: 1 },
        },
      })
      // ensure-account: conta garantida.
      .mockResolvedValueOnce({ data: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Nubank', isActive: true } })
      // repreview-batch após criar/rotear.
      .mockResolvedValueOnce({ data: { previewRows: [], reconciliation: { exact: 0, likely: 0, new: 1 } } });

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <StatementImportPanel accounts={accounts} categories={categories} />
      </QueryClientProvider>,
    );

    // Dois ficheiros → modo lote (isBatch).
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input!, {
      target: {
        files: [
          new File(['x'], 'a.ofx', { type: 'application/x-ofx' }),
          new File(['y'], 'b.ofx', { type: 'application/x-ofx' }),
        ],
      },
    });
    // Lote: a selecção dispara o preview-batch automaticamente.
    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        '/imports/statement/preview-batch',
        expect.any(FormData),
        expect.any(Object),
      );
    });

    // Aciona o auto-cadastro das contas em falta.
    fireEvent.click(screen.getByRole('button', { name: /Criar conta\(s\) e reprocessar/i }));
    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/imports/statement/ensure-account', {
        name: 'Nubank',
        bankId: '260',
        branchNumber: '1',
        accountNumber: '257161786',
      });
    });
    // Garante que NÃO usou o endpoint público de criação de conta.
    expect(post).not.toHaveBeenCalledWith('/accounts', expect.anything());
  });
});
