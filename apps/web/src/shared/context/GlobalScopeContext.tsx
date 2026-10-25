import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from '@features/auth/AuthProvider';
import type { DashboardScope } from '@features/dashboard/useDashboard';

interface GlobalScopeContextType {
  scope: DashboardScope;
  setScope: (scope: DashboardScope) => void;
}

const GlobalScopeContext = createContext<GlobalScopeContextType | undefined>(undefined);

export function GlobalScopeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // Default to the logged-in user's ID
  const [scope, setScope] = useState<DashboardScope>('all');

  useEffect(() => {
    if (user?.id && scope === 'all') {
      // Inicially, set to logged-in user if available. But await, what about "default to logged in user"?
      // Yes, default to logged in user's ID.
      setScope(user.id);
    }
  }, [user?.id, scope]); // Only run when user id becomes available or scope is 'all'

  return (
    <GlobalScopeContext.Provider value={{ scope, setScope }}>
      {children}
    </GlobalScopeContext.Provider>
  );
}

export function useGlobalScope() {
  const context = useContext(GlobalScopeContext);
  if (!context) {
    throw new Error('useGlobalScope must be used within a GlobalScopeProvider');
  }
  return context;
}
