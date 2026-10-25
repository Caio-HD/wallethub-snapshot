import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import apiClient, { bindAccessTokenProvider } from '@shared/lib/apiClient';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { Tokens, User } from '@entities/user';
import i18n from '@shared/i18n/config';

interface LoginPayload {
  username: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  tokens: Tokens | null;
  isBootstrapping: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  loginWithPasskey: (username: string) => Promise<void>;
  registerPasskey: () => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<Tokens | null>;
  requestOtp: (type: 'email' | 'phone', identifier: string) => Promise<void>;
  register: (payload: { name: string; email?: string; phoneNumber?: string }) => Promise<void>;
  verifyOtp: (type: 'email' | 'phone', identifier: string, code: string) => Promise<void>;
  loginWithSocial: (provider: 'google' | 'github' | 'facebook' | 'instagram') => void;
  linkSocial: (provider: 'google' | 'github' | 'facebook') => Promise<void>;
  unlinkSocial: (provider: 'google' | 'github' | 'facebook') => Promise<void>;
  validateIdentifier: (identifier: string) => Promise<{ exists: boolean, methods: string[], userId?: string, username?: string, name?: string }>;
  forgotPassword: (identifier: string) => Promise<void>;
  resetPassword: (identifier: string, code: string, password: string) => Promise<void>;
  requestEmailChange: (newEmail: string) => Promise<void>;
  confirmEmailChange: (newEmail: string, code: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEYS = {
  tokens: 'wallethub::tokens',
  user: 'wallethub::user',
} as const;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const isRefreshingRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<Tokens | null> | null>(null);
  const tokensRef = useRef<Tokens | null>(null);

  const persistState = useCallback((nextTokens: Tokens | null, nextUser: User | null) => {
    if (nextTokens) {
      localStorage.setItem(STORAGE_KEYS.tokens, JSON.stringify(nextTokens));
    } else {
      localStorage.removeItem(STORAGE_KEYS.tokens);
    }

    if (nextUser) {
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.user);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    const { data } = await apiClient.get<User>('/users/me');
    setUser(data);
    persistState(tokensRef.current, data);
    // Sincroniza idioma persistido na API sem causar flash: i18next já carregou o localStorage
    // na inicialização síncrona; aqui apenas corrigimos se a API tiver valor diferente.
    if (data.preferredLanguage && data.preferredLanguage !== i18n.language) {
      void i18n.changeLanguage(data.preferredLanguage);
    }
  }, [persistState]);

  tokensRef.current = tokens;

  const setTokensState = useCallback(
    (nextTokens: Tokens | null) => {
      tokensRef.current = nextTokens;
      setTokens(nextTokens);

      setUser((prevUser) => {
        const nextUser = nextTokens ? prevUser : null;
        persistState(nextTokens, nextUser);
        return nextUser;
      });
    },
    [persistState],
  );

  const handleBootstrap = useCallback(async () => {
    try {
      const storedTokens = localStorage.getItem(STORAGE_KEYS.tokens);
      const storedUser = localStorage.getItem(STORAGE_KEYS.user);

      if (storedTokens) {
        const parsedTokens = JSON.parse(storedTokens) as Tokens;
        setTokens(parsedTokens);
        tokensRef.current = parsedTokens;
        bindAccessTokenProvider(() => tokensRef.current?.accessToken ?? null);

        if (storedUser) {
          setUser(JSON.parse(storedUser) as User);
        }
        // Sempre faz loadProfile para garantir que o estado está fresco (ex: foto nova)
        await loadProfile();
      }
    } catch {
      setTokensState(null);
      setUser(null);
    } finally {
      bindAccessTokenProvider(() => tokensRef.current?.accessToken ?? null);
      setIsBootstrapping(false);
    }
  }, [loadProfile, setTokensState]);

  useEffect(() => {
    handleBootstrap();
  }, [handleBootstrap]);

  useEffect(() => {
    bindAccessTokenProvider(() => tokensRef.current?.accessToken ?? null);
  }, [tokens]);

  useEffect(() => {
    const interceptorId = apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // Prevent infinite loops if the refresh token itself is rejected
        if (originalRequest.url?.includes('/auth/refresh')) {
          return Promise.reject(error);
        }

        if (error.response?.status === 401 && !originalRequest._retry && tokensRef.current?.refreshToken) {
          originalRequest._retry = true;
          try {
            const refreshed = await triggerRefresh();
            if (refreshed) {
              error.config.headers = error.config.headers ?? {};
              error.config.headers.Authorization = `Bearer ${refreshed.accessToken}`;
              return apiClient.request(error.config);
            }
          } catch (refreshError) {
            await logout();
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      },
    );

    return () => {
      apiClient.interceptors.response.eject(interceptorId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerRefresh = useCallback(async (): Promise<Tokens | null> => {
    if (!tokensRef.current?.refreshToken) {
      return null;
    }

    if (isRefreshingRef.current && refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    isRefreshingRef.current = true;
    // API: JwtRefreshStrategy usa ExtractJwt.fromBodyField('refreshToken'), não Authorization
    const refreshRequest = apiClient.post<Tokens>('/auth/refresh', {
      refreshToken: tokensRef.current.refreshToken,
    })
      .then((response) => {
        setTokensState(response.data);
        return response.data;
      })
      .catch((error) => {
        setTokensState(null);
        persistState(null, null);
        setUser(null);
        return Promise.reject(error);
      })
      .finally(() => {
        isRefreshingRef.current = false;
        refreshPromiseRef.current = null;
      });

    refreshPromiseRef.current = refreshRequest;
    return refreshRequest;
  }, [persistState, setTokensState]);

  const login = useCallback(
    async ({ username, password }: LoginPayload) => {
      const { data } = await apiClient.post<Tokens>('/auth/login', {
        username,
        password,
      });
      setTokensState(data);
      await loadProfile();
    },
    [loadProfile, setTokensState],
  );
  
  const loginWithPasskey = useCallback(async (username: string) => {
    const { data: options } = await apiClient.post('/auth/login/options', null, {
        params: { username }
    });
    
    const authResponse = await startAuthentication(options);
    
    const { data: tokens } = await apiClient.post<Tokens>('/auth/login/verify', authResponse, {
        params: { userId: options.userId }
    });
    
    setTokensState(tokens);
    await loadProfile();
  }, [loadProfile, setTokensState]);

  const registerPasskey = useCallback(async () => {
    const { data: options } = await apiClient.post('/auth/register/options');
    const regResponse = await startRegistration(options);
    await apiClient.post('/auth/register/verify', regResponse);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokensRef.current?.refreshToken;
    try {
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken });
      }
    } catch {
      // logout silently — tokens cleared below
    } finally {
      setTokensState(null);
      setUser(null);
      persistState(null, null);
    }
  }, [persistState, setTokensState]);

  const requestOtp = useCallback(async (type: 'email' | 'phone', identifier: string) => {
    await apiClient.post('/auth/otp/request', { type, identifier });
  }, []);

  const register = useCallback(
    async (payload: { name: string; email?: string; phoneNumber?: string }) => {
      await apiClient.post('/auth/register', payload);
    },
    [],
  );

  const verifyOtp = useCallback(async (type: 'email' | 'phone', identifier: string, code: string) => {
    const { data: tokens } = await apiClient.post<Tokens>('/auth/otp/verify', { type, identifier, code });
    setTokensState(tokens);
    await loadProfile();
  }, [loadProfile, setTokensState]);

  const loginWithSocial = useCallback((provider: 'google' | 'github' | 'facebook' | 'instagram') => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    // Instagram não tem OAuth de login standalone: o login de consumidor via
    // Meta passa pelo Facebook Login, então roteamos o botão Instagram para ele.
    const endpoint = provider === 'instagram' ? 'facebook' : provider;
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      `${apiUrl}/auth/${endpoint}`,
      'Social Login',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    const checkPopup = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(checkPopup);
        // Em um sistema real, o backend redirecionaria para uma página que faz postMessage
        // Para simplificar agora, o usuário deve atualizar ou o backend redireciona p/ frontend com tokens
        // O ideal é usar o postMessage listener no useEffect
      }
    }, 1000);
  }, []);

  // F2: conectar um provedor à conta logada. Pede um `state` curto ao backend
  // e abre o popup OAuth com ele; o callback vincula em vez de logar/criar. O
  // listener de SOCIAL_AUTH_SUCCESS (useEffect abaixo) atualiza o perfil.
  const linkSocial = useCallback(async (provider: 'google' | 'github' | 'facebook') => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const { data } = await apiClient.post<{ state: string }>('/auth/social/link-token');
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    window.open(
      `${apiUrl}/auth/${provider}?state=${encodeURIComponent(data.state)}`,
      'Social Link',
      `width=${width},height=${height},left=${left},top=${top}`,
    );
  }, []);

  const unlinkSocial = useCallback(
    async (provider: 'google' | 'github' | 'facebook') => {
      await apiClient.delete(`/auth/social/${provider}`);
      await loadProfile();
    },
    [loadProfile],
  );

  const validateIdentifier = useCallback(async (identifier: string) => {
    const { data } = await apiClient.post('/auth/validate-identifier', { identifier });
    return data;
  }, []);

  const forgotPassword = useCallback(async (identifier: string) => {
    await apiClient.post('/auth/forgot-password', { identifier });
  }, []);

  const resetPassword = useCallback(async (identifier: string, code: string, password: string) => {
    await apiClient.post('/auth/reset-password', { identifier, code, password });
  }, []);

  // F3b: troca de e-mail com OTP no novo endereço.
  const requestEmailChange = useCallback(async (newEmail: string) => {
    await apiClient.post('/auth/email/change/request', { newEmail });
  }, []);

  const confirmEmailChange = useCallback(
    async (newEmail: string, code: string) => {
      await apiClient.post('/auth/email/change/confirm', { newEmail, code });
      await loadProfile();
    },
    [loadProfile],
  );

  const refreshTokens = useCallback(async () => {
    try {
      const refreshed = await triggerRefresh();
      if (refreshed && !user) {
        await loadProfile();
      }
      return refreshed;
    } catch {
      return null;
    }
  }, [loadProfile, triggerRefresh, user]);

  useEffect(() => {
    const handleSocialMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'SOCIAL_AUTH_SUCCESS') {
        const nextTokens = event.data.tokens as Tokens;
        setTokensState(nextTokens);
        loadProfile();
      }
    };
    window.addEventListener('message', handleSocialMessage);
    return () => window.removeEventListener('message', handleSocialMessage);
  }, [loadProfile, setTokensState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      tokens,
      isBootstrapping,
      login,
      loginWithPasskey,
      registerPasskey,
      logout,
      refreshTokens,
      requestOtp,
      register,
      verifyOtp,
      loginWithSocial,
      linkSocial,
      unlinkSocial,
      validateIdentifier,
      forgotPassword,
      resetPassword,
      requestEmailChange,
      confirmEmailChange,
      refreshProfile: loadProfile,
    }),
    [
      login,
      loginWithPasskey,
      registerPasskey,
      logout,
      refreshTokens,
      requestOtp,
      register,
      verifyOtp,
      loginWithSocial,
      linkSocial,
      unlinkSocial,
      validateIdentifier,
      forgotPassword,
      resetPassword,
      requestEmailChange,
      confirmEmailChange,
      loadProfile,
      tokens,
      user,
      isBootstrapping,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
