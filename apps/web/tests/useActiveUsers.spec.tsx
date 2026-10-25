import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActiveUsers } from '@features/dashboard/useActiveUsers';
import apiClient from '@shared/lib/apiClient';

vi.mock('@shared/lib/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

// useActiveUsers passou a depender da organização ativa (query só dispara com activeOrganizationId).
vi.mock('@shared/context/ActiveOrganizationContext', () => ({
  useActiveOrganization: () => ({ activeOrganizationId: 'org-1' }),
}));

const mockedGet = vi.mocked(apiClient.get);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useActiveUsers', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({ data: [] });
  });

  it('pede /users/active', async () => {
    renderHook(() => useActiveUsers(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith('/users/active');
    });
  });
});
