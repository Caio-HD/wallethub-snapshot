import { useQuery } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  ownerUserId: string | null;
  isActive: boolean;
}

export const useCategories = () => {
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;
  return useQuery<Category[]>({
    queryKey: ['categories', activeOrganizationId, 'transactions-form'],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<Category[]>('/categories');
      return data.filter((category) => category.isActive);
    },
    staleTime: 1000 * 60 * 5,
  });
};
