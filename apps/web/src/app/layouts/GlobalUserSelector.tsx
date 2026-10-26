import { useEffect, useMemo } from 'react';
import { Users } from 'lucide-react';
import { useActiveUsers } from '@features/dashboard/useActiveUsers';
import { useGlobalScope } from '@shared/context/GlobalScopeContext';
import { Select } from '@shared/ui/select';
import type { DashboardScope } from '@features/dashboard/useDashboard';

export const GlobalUserSelector = () => {
  const { scope, setScope } = useGlobalScope();
  const { data: users = [], isLoading, isError } = useActiveUsers();

  useEffect(() => {
    if (scope === 'all' || !users.length || isError) return;
    if (!users.some((u) => u.id === scope)) setScope('all');
  }, [users, scope, setScope, isError]);

  const options = useMemo(() => {
    if (isError || !users.length) return [];
    return [
      { id: 'all' as DashboardScope, name: 'Todos' },
      ...users.map((u) => ({ id: u.id as DashboardScope, name: u.name })),
    ];
  }, [users, isError]);

  if (isLoading || isError || options.length <= 1) return null;

  return (
    <Select
      className="min-w-[10rem] max-w-[14rem]"
      label="Utilizador"
      icon={<Users className="h-3.5 w-3.5" />}
      options={options}
      value={scope}
      onChange={(v) => setScope(v as DashboardScope)}
      placeholder="Utilizador"
    />
  );
};
