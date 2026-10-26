import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useEvolutionReport } from '@features/dashboard/useDashboard';
import apiClient from '@shared/lib/apiClient';

vi.mock('@shared/context/ActiveOrganizationContext', () => ({
  useActiveOrganization: () => ({
    activeOrganizationId: '00000000-0000-0000-0000-000000000099',
    isLoadingOrganizations: false,
    organizations: [],
    setActiveOrganizationId: vi.fn(),
  }),
}));

vi.mock('@shared/lib/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useEvolutionReport', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({ data: { scope: 'all', items: [] } });
  });

  it('envia params.periods com CSV quando há lista explícita (multi-seleção)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const periods = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

    renderHook(() => useEvolutionReport('all', { periods }), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith(
        '/dashboard/evolution',
        expect.objectContaining({
          params: expect.objectContaining({
            periods: '2026-02,2026-03,2026-04,2026-05,2026-06',
          }),
        }),
      );
    });
  });

  it('envia months no modo legado (picker por número de meses)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useEvolutionReport('all', { months: 3 }), { wrapper: createWrapper(qc) });

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith(
        '/dashboard/evolution',
        expect.objectContaining({
          params: expect.objectContaining({ months: '3' }),
        }),
      );
    });
  });

  it('inclui userId quando o scope é um titular', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scopeUser = '33333333-3333-4333-8333-333333333333';

    renderHook(() => useEvolutionReport(scopeUser, { months: 6 }), { wrapper: createWrapper(qc) });

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith(
        '/dashboard/evolution',
        expect.objectContaining({
          params: expect.objectContaining({ months: '6', userId: scopeUser }),
        }),
      );
    });
  });

  it('envia anchor, pastMonths e futureMonths no modo âncora (um mês no picker)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(
      () =>
        useEvolutionReport('all', {
          anchor: '2026-03',
          pastMonths: 5,
          futureMonths: 0,
        }),
      { wrapper: createWrapper(qc) },
    );

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith(
        '/dashboard/evolution',
        expect.objectContaining({
          params: expect.objectContaining({
            anchor: '2026-03',
            pastMonths: '5',
            futureMonths: '0',
            months: '6',
          }),
        }),
      );
    });
  });
});
