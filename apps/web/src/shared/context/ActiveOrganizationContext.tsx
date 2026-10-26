import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import apiClient, { bindOrganizationIdProvider } from '@shared/lib/apiClient';
import { useAuth } from '@features/auth/AuthProvider';

const STORAGE_KEY = 'wallethub::activeOrganizationId';

export type OrganizationSummary = {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'plus';
};

type ActiveOrganizationContextValue = {
  organizations: OrganizationSummary[];
  activeOrganizationId: string | null;
  activeOrganization: OrganizationSummary | null;
  setActiveOrganizationId: (id: string) => void;
  /** Operador: limpa org activa (sair do modo auditoria). */
  clearActiveOrganization: () => void;
  isLoadingOrganizations: boolean;
  refreshOrganizations: () => Promise<void>;
  /** super_admin operador de plataforma (sem membership pessoal). */
  isPlatformOperator: boolean;
  /** Operador com org seleccionada para impersonation (cabeçalho X-Organization-Id). */
  isAuditMode: boolean;
};

const ActiveOrganizationContext = createContext<ActiveOrganizationContextValue | undefined>(
  undefined,
);

export const ActiveOrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { tokens, isBootstrapping, user } = useAuth();
  const isPlatformOperator = user?.role === 'super_admin';
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string | null>(null);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!tokens || isBootstrapping) {
      setOrganizations([]);
      setActiveOrganizationIdState(null);
      bindOrganizationIdProvider(() => null);
      setIsLoadingOrganizations(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoadingOrganizations(true);
    void (async () => {
      try {
        const { data } = await apiClient.get<OrganizationSummary[]>('/organizations');
        if (cancelled) return;
        setOrganizations(data);
        const stored = localStorage.getItem(STORAGE_KEY);
        const fallback = data[0]?.id ?? null;
        const next =
          stored && data.some((o) => o.id === stored) ? stored : fallback;
        setActiveOrganizationIdState(next);
        if (next) {
          localStorage.setItem(STORAGE_KEY, next);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        if (!cancelled) {
          setOrganizations([]);
          setActiveOrganizationIdState(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOrganizations(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tokens, isBootstrapping]);

  useEffect(() => {
    bindOrganizationIdProvider(() => activeOrganizationId);
  }, [activeOrganizationId]);

  const setActiveOrganizationId = useCallback((id: string) => {
    setActiveOrganizationIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const clearActiveOrganization = useCallback(() => {
    setActiveOrganizationIdState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const refreshOrganizations = useCallback(async () => {
    if (!tokens || isBootstrapping) return;
    const { data } = await apiClient.get<OrganizationSummary[]>('/organizations');
    setOrganizations(data);
    setActiveOrganizationIdState((prev) => {
      if (prev && data.some((o) => o.id === prev)) {
        return prev;
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      const fromStorage = stored && data.some((o) => o.id === stored) ? stored : null;
      const next = fromStorage ?? data[0]?.id ?? null;
      if (next) {
        localStorage.setItem(STORAGE_KEY, next);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      return next;
    });
  }, [tokens, isBootstrapping]);

  const value = useMemo<ActiveOrganizationContextValue>(
    () => ({
      organizations,
      activeOrganizationId,
      activeOrganization:
        activeOrganizationId != null
          ? organizations.find((organization) => organization.id === activeOrganizationId) ?? null
          : null,
      setActiveOrganizationId,
      clearActiveOrganization,
      isLoadingOrganizations,
      refreshOrganizations,
      isPlatformOperator,
      isAuditMode: isPlatformOperator && activeOrganizationId != null,
    }),
    [
      organizations,
      activeOrganizationId,
      setActiveOrganizationId,
      clearActiveOrganization,
      isLoadingOrganizations,
      refreshOrganizations,
      isPlatformOperator,
    ],
  );

  return (
    <ActiveOrganizationContext.Provider value={value}>{children}</ActiveOrganizationContext.Provider>
  );
};

export const useActiveOrganization = (): ActiveOrganizationContextValue => {
  const ctx = useContext(ActiveOrganizationContext);
  if (!ctx) {
    throw new Error('useActiveOrganization must be used within ActiveOrganizationProvider');
  }
  return ctx;
};
