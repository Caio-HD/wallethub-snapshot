import { useQuery } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

export interface Account {
  id: string;
  name: string;
  ownerUserId: string | null;
  initialBalance: string;
  isActive: boolean;
}

export const useAccounts = () => {
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;
  return useQuery<Account[]>({
    queryKey: ['accounts', activeOrganizationId, 'transactions-form'],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<Account[]>('/accounts');
      return data.filter((account) => account.isActive);
    },
    staleTime: 1000 * 60 * 5,
  });
};
