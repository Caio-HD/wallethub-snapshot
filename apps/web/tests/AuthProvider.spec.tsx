import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, beforeEach, vi, it, afterEach } from 'vitest';
import { AuthProvider, useAuth } from '@features/auth/AuthProvider';
import apiClient, { bindAccessTokenProvider } from '@shared/lib/apiClient';

vi.mock('@shared/lib/apiClient', () => {
  const interceptors = {
    response: {
      use: vi.fn(() => 1),
      eject: vi.fn(),
    },
  };
  return {
    default: {
      post: vi.fn(),
      get: vi.fn(),
      interceptors,
    },
    bindAccessTokenProvider: vi.fn(),
    bindOrganizationIdProvider: vi.fn(),
  };
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const StatusProbe = () => {
  const { isBootstrapping } = useAuth();
  return <span>{isBootstrapping ? 'loading' : 'ready'}</span>;
};

const LoginProbe = () => {
  const { login, user } = useAuth();
  const handleLogin = async () => {
    await login({ username: 'testuser', password: 'secret' });
  };
  return (
    <>
      <button onClick={handleLogin}>login</button>
      <span data-testid="user-name">{user?.name ?? 'anonymous'}</span>
    </>
  );
};

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('completa bootstrap sem tokens armazenados', async () => {
    render(
      <TestWrapper>
        <AuthProvider>
          <StatusProbe />
        </AuthProvider>
      </TestWrapper>,
    );

    await waitFor(() => expect(screen.getByText('ready')).toBeInTheDocument());
    expect(bindAccessTokenProvider).toHaveBeenCalled();
  });

  it('executa login e carrega perfil', async () => {
    const mockedApiClient = vi.mocked(apiClient, true);
    mockedApiClient.post.mockResolvedValue({
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
      },
    });
    mockedApiClient.get.mockResolvedValue({
      data: { id: '1', name: 'Tester', email: 'user@example.com', phoneNumber: null, role: 'admin' },
    });

    render(
      <TestWrapper>
        <AuthProvider>
          <LoginProbe />
        </AuthProvider>
      </TestWrapper>,
    );

    await waitFor(() => expect(screen.getByTestId('user-name')).toHaveTextContent('anonymous'));

    fireEvent.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('user-name')).toHaveTextContent('Tester'));
    expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/login', {
      username: 'testuser',
      password: 'secret',
    });
    expect(bindAccessTokenProvider).toHaveBeenCalled();
  });
});
