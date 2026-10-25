import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DashboardPage } from '@pages/dashboard/DashboardPage';

// Usa o i18n real (inicializado em tests/setup.ts, forçado para 'pt') em vez de um mock de chaves
// que vivia desatualizado. As chaves reais (kpi.balance => 'Saldo', etc.) já resolvem.

vi.mock('@shared/context/GlobalScopeContext', () => ({
  useGlobalScope: () => ({ scope: 'all' as const, setScope: vi.fn() }),
  GlobalScopeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@features/dashboard/useDashboard', () => ({
  evolutionParamsFromDashboardPeriod: () => ({
    anchor: '2025-01',
    pastMonths: 5,
    futureMonths: 0,
  }),
  useDashboardSummary: () => ({
    data: {
      scope: 'all',
      period: '2025-01',
      totalIncome: 1500,
      totalExpense: 700,
      balance: 800,
      trend: 'up',
      comparison: {
        incomeDelta: 10,
        expenseDelta: -5,
        balanceDelta: 12,
      },
      topCategories: [],
    },
    isLoading: false,
  }),
  useCategoriesReport: () => ({ data: { items: [] }, isLoading: false }),
  useTopTransactions: () => ({ data: { scope: 'all', items: [] }, isLoading: false }),
  useProjections: () => ({ data: null, isLoading: false }),
  useEvolutionReport: () => ({
    data: {
      items: [
        {
          period: '2025-01',
          totalIncome: 100,
          totalExpense: 50,
          balance: 50,
          rowKind: 'actual' as const,
        },
      ],
    },
    isLoading: false,
  }),
  useRecalculateDashboard: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
    isError: false,
    isSuccess: false,
    reset: vi.fn(),
  }),
}));

vi.mock('@features/dashboard/useActiveUsers', () => ({
  useActiveUsers: () => ({ data: [], isLoading: false, isError: false }),
}));

// Filtro e card de saldo por conta consomem useAccounts (que usa ActiveOrganization).
vi.mock('@features/accounts/useAccounts', () => ({
  useAccounts: () => ({ accounts: [], isLoading: false }),
}));

// DashboardPage passou a usar useAuth() — mock do provider para o teste de render.
vi.mock('@features/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Test', username: 'test', baseCurrency: 'BRL' } }),
}));

vi.mock('@features/dashboard/CashflowTimelineChart', () => ({
  CashflowTimelineChart: () => <div data-testid="cashflow-timeline-chart" />,
}));

vi.mock('@features/investments/useInvestments', () => ({
  usePortfolio: () => ({ data: { totalMarketValue: 0 }, isLoading: false }),
  useInvestmentPeriodSummary: () => ({ data: undefined, isLoading: false }),
}));

describe('DashboardPage', () => {
  it('renderiza KPIs e componentes principais', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <DashboardPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Saldo')).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*800,00/)).not.toHaveLength(0);
    expect(screen.getByTestId('categories-report-section')).toBeInTheDocument();
    expect(screen.getByText('Relatório por categorias')).toBeInTheDocument();
    expect(screen.getByTestId('cashflow-timeline-chart')).toBeInTheDocument();
  });
});
