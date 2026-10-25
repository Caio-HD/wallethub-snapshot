import { useQuery } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

export interface ActiveUserRow {
  id: string;
  name: string;
  isActive: boolean;
  membershipRole: 'owner' | 'admin' | 'member';
  messagingAiEnabled: boolean;
}

export const useActiveUsers = () => {
  const { activeOrganizationId } = useActiveOrganization();
  return useQuery<ActiveUserRow[]>({
    queryKey: ['users', 'active', activeOrganizationId],
    queryFn: async () => {
      const { data } = await apiClient.get<ActiveUserRow[]>('/users/active');
      return data;
    },
    staleTime: 1000 * 60 * 2,
    enabled: !!activeOrganizationId,
  });
};
