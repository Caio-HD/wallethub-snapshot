import { render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GlobalScopeProvider, useGlobalScope } from '@shared/context/GlobalScopeContext';
import { useAuth } from '@features/auth/AuthProvider';

vi.mock('@features/auth/AuthProvider');

const userId = '22222222-2222-4222-8222-222222222222';

function ScopeProbe() {
  const { scope } = useGlobalScope();
  return <span data-testid="scope">{scope}</span>;
}

describe('GlobalScopeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('define scope para o utilizador autenticado quando começa em all', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: userId, name: 'U', phoneNumber: null, photoUrl: null, role: 'admin' },
      tokens: null,
      isBootstrapping: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshTokens: vi.fn(),
    } as ReturnType<typeof useAuth>);

    render(
      <GlobalScopeProvider>
        <ScopeProbe />
      </GlobalScopeProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('scope')).toHaveTextContent(userId));
  });

  it('useGlobalScope falha fora do provider', () => {
    expect(() => renderHook(() => useGlobalScope())).toThrow(/useGlobalScope must be used within a GlobalScopeProvider/);
  });
});
