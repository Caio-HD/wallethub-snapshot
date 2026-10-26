import { render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ActiveOrganizationProvider,
  useActiveOrganization,
} from '@shared/context/ActiveOrganizationContext';
import apiClient from '@shared/lib/apiClient';
import { useAuth } from '@features/auth/AuthProvider';

vi.mock('@features/auth/AuthProvider');

const orgId = '11111111-1111-4111-8111-111111111111';

function Probe() {
  const v = useActiveOrganization();
  return (
    <div>
      <span data-testid="loading">{v.isLoadingOrganizations ? 'loading' : 'ready'}</span>
      <span data-testid="active">{v.activeOrganizationId ?? 'none'}</span>
      <span data-testid="count">{v.organizations.length}</span>
    </div>
  );
}

describe('ActiveOrganizationProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      tokens: {
        accessToken: 'a',
        refreshToken: 'r',
        expiresIn: 3600,
        tokenType: 'Bearer',
      },
      isBootstrapping: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshTokens: vi.fn(),
    } as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('carrega organizações e persiste a selecção por omissão', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: [{ id: orgId, name: 'Org A', plan: 'free' as const }],
    });

    render(
      <ActiveOrganizationProvider>
        <Probe />
      </ActiveOrganizationProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'));
    expect(get).toHaveBeenCalledWith('/organizations');
    expect(screen.getByTestId('active')).toHaveTextContent(orgId);
    expect(localStorage.getItem('wallethub::activeOrganizationId')).toBe(orgId);
  });

  it('limpa estado quando não há sessão', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      tokens: null,
      isBootstrapping: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshTokens: vi.fn(),
    } as ReturnType<typeof useAuth>);

    const get = vi.spyOn(apiClient, 'get');

    render(
      <ActiveOrganizationProvider>
        <Probe />
      </ActiveOrganizationProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'));
    expect(get).not.toHaveBeenCalled();
    expect(screen.getByTestId('active')).toHaveTextContent('none');
  });

  it('useActiveOrganization falha fora do provider', () => {
    expect(() => renderHook(() => useActiveOrganization())).toThrow(
      /useActiveOrganization must be used within ActiveOrganizationProvider/,
    );
  });
});
