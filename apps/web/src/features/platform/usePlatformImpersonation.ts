import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { startPlatformImpersonation } from '@features/platform/api';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

export function usePlatformImpersonation() {
  const navigate = useNavigate();
  const { setActiveOrganizationId, refreshOrganizations } = useActiveOrganization();

  const mutation = useMutation({
    mutationFn: (params: { organizationId: string; organizationName?: string }) =>
      startPlatformImpersonation(params.organizationId),
    onSuccess: async (result, { organizationId }) => {
      setActiveOrganizationId(organizationId);
      await refreshOrganizations();
      toast.success(
        result.organizationName
          ? `A auditar «${result.organizationName}» — dados financeiros activos`
          : 'Modo auditoria activo',
      );
      navigate('/dashboard');
    },
    onError: () => toast.error('Não foi possível iniciar a auditoria desta organização'),
  });

  const openAsOrganization = useCallback(
    (organizationId: string, organizationName?: string) => {
      mutation.mutate({ organizationId, organizationName });
    },
    [mutation],
  );

  return { openAsOrganization, isImpersonating: mutation.isPending };
}
