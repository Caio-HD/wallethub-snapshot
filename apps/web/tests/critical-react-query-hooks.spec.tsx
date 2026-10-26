import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useCategoryBudgets,
  useDeleteCategoryBudget,
  useMonthlyBudget,
  usePropagateEstimatedIncome,
  useSetCategoryBudget,
  useSetMonthlyBudget,
} from '@features/budgets/useBudgets';
import {
  useCategoriesReport,
  useDashboardSummary,
  useProjections,
} from '@features/dashboard/useDashboard';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
} from '@features/transactions/useTransactions';
import apiClient from '@shared/lib/apiClient';

vi.mock('@shared/context/ActiveOrganizationContext', () => ({
  useActiveOrganization: () => ({
    activeOrganizationId: '11111111-1111-4111-8111-111111111111',
    isLoadingOrganizations: false,
    organizations: [],
    setActiveOrganizationId: vi.fn(),
  }),
}));

vi.mock('@shared/lib/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedPatch = vi.mocked(apiClient.patch);
const mockedDelete = vi.mocked(apiClient.delete);
const mockedPut = vi.mocked(apiClient.put);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('hooks de dados (transactions / budgets / dashboard)', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
    mockedPatch.mockReset();
    mockedDelete.mockReset();
    mockedPut.mockReset();
    mockedGet.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('useTransactions pede /transactions com filtros', async () => {
    mockedGet.mockResolvedValue({ data: [] });
    renderHook(
      () =>
        useTransactions({
          period: { start: '2025-01-01', end: '2025-01-31' },
          categoryId: 'cat',
          userId: 'usr',
          accountId: 'acc',
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith(
        '/transactions',
        expect.objectContaining({
          params: expect.objectContaining({
            categoryId: 'cat',
            userId: 'usr',
            accountId: 'acc',
            range: '2025-01-01,2025-01-31',
          }),
        }),
      );
    });
  });

  it('useCreateTransaction faz POST e devolve dados', async () => {
    mockedPost.mockResolvedValue({ data: { id: 't1' } });
    const { result } = renderHook(() => useCreateTransaction(), { wrapper: createWrapper() });

    await result.current.mutateAsync({
      occurredAt: '2025-01-01',
      accountId: 'a',
      categoryId: 'c',
      amount: 10,
    });

    expect(mockedPost).toHaveBeenCalledWith('/transactions', expect.any(Object));
  });

  it('useUpdateTransaction faz PATCH', async () => {
    mockedPatch.mockResolvedValue({ data: { id: 't1' } });
    const { result } = renderHook(() => useUpdateTransaction(), { wrapper: createWrapper() });

    await result.current.mutateAsync({
      id: 't1',
      data: { amount: 20 },
    });

    expect(mockedPatch).toHaveBeenCalledWith('/transactions/t1', { amount: 20 });
  });

  it('useDeleteTransaction faz DELETE', async () => {
    mockedDelete.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteTransaction(), { wrapper: createWrapper() });

    await result.current.mutateAsync('t1');

    expect(mockedDelete).toHaveBeenCalledWith('/transactions/t1');
  });

  it('useCategoryBudgets pede /budgets/category', async () => {
    mockedGet.mockResolvedValue({ data: [] });
    renderHook(() => useCategoryBudgets('all', '2025-01'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith(
        '/budgets/category',
        expect.objectContaining({ params: { period: '2025-01' } }),
      );
    });
  });

  it('useCategoryBudgets inclui userId quando o scope não é all', async () => {
    mockedGet.mockResolvedValue({ data: [] });
    renderHook(() => useCategoryBudgets('user-1', '2025-01'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith(
        '/budgets/category',
        expect.objectContaining({ params: { userId: 'user-1', period: '2025-01' } }),
      );
    });
  });

  it('useMonthlyBudget pede /budgets/monthly', async () => {
    mockedGet.mockResolvedValue({ data: null });
    renderHook(() => useMonthlyBudget('all', '2025-01'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith(
        '/budgets/monthly',
        expect.objectContaining({ params: { period: '2025-01' } }),
      );
    });
  });

  it('useSetCategoryBudget faz PUT', async () => {
    mockedPut.mockResolvedValue({ data: { id: 'b1' } });
    const { result } = renderHook(() => useSetCategoryBudget('all', '2025-01'), { wrapper: createWrapper() });

    await result.current.mutateAsync({
      categoryId: 'c1',
      period: '2025-01',
      amount: 100,
    });

    expect(mockedPut).toHaveBeenCalledWith('/budgets/category', expect.any(Object));
  });

  it('useSetMonthlyBudget faz PUT', async () => {
    mockedPut.mockResolvedValue({ data: { id: 'm1' } });
    const { result } = renderHook(() => useSetMonthlyBudget(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ period: '2025-01', estimatedAverageIncome: 200 });

    expect(mockedPut).toHaveBeenCalledWith('/budgets/monthly', expect.any(Object));
  });

  it('usePropagateEstimatedIncome faz PUT no endpoint de propagação', async () => {
    mockedPut.mockResolvedValue({ data: { updated: 3 } });
    const { result } = renderHook(() => usePropagateEstimatedIncome(), { wrapper: createWrapper() });

    await result.current.mutateAsync({
      fromPeriod: '2025-01',
      estimatedAverageIncome: 5000,
    });

    expect(mockedPut).toHaveBeenCalledWith(
      '/budgets/monthly/propagate-estimated-income',
      expect.any(Object),
    );
  });

  it('useDeleteCategoryBudget faz DELETE com params', async () => {
    mockedDelete.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteCategoryBudget('all', '2025-01'), { wrapper: createWrapper() });

    await result.current.mutateAsync('cat-1');

    expect(mockedDelete).toHaveBeenCalledWith(
      '/budgets/category',
      expect.objectContaining({
        params: expect.objectContaining({ categoryId: 'cat-1', period: '2025-01' }),
      }),
    );
  });

  it('useCategoriesReport pede /dashboard/categories-report', async () => {
    mockedGet.mockResolvedValue({ data: { period: '2025-01', scope: 'all', items: [] } });
    renderHook(() => useCategoriesReport('all', '2025-01'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith(
        '/dashboard/categories-report',
        expect.objectContaining({ params: { period: '2025-01' } }),
      );
    });
  });

  it('useDashboardSummary pede /dashboard/summary', async () => {
    mockedGet.mockResolvedValue({
      data: {
        period: '2025-01',
        scope: 'all',
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        topCategories: [],
      },
    });
    renderHook(() => useDashboardSummary('all', '2025-01'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith(
        '/dashboard/summary',
        expect.objectContaining({ params: { period: '2025-01' } }),
      );
    });
  });

  it('useProjections pede /dashboard/projections', async () => {
    mockedGet.mockResolvedValue({ data: null });
    renderHook(() => useProjections('all'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith(
        '/dashboard/projections',
        expect.objectContaining({ params: {} }),
      );
    });
  });
});
