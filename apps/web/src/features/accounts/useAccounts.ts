import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';
import { useGlobalScope } from '@shared/context/GlobalScopeContext';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

export interface Account {
  id: string;
  name: string;
  balance: string;
  lastBalanceUpdateAt: string | null;
  ownerUserIds: string[] | null;
  isActive: boolean;
  bankId: string | null;
  branchNumber: string | null;
  accountNumber: string | null;
}

export interface CreateAccountDto {
  name: string;
  balance?: number;
  ownerUserIds?: string[] | null;
  bankId?: string | null;
  branchNumber?: string | null;
  accountNumber?: string | null;
}

export interface UpdateAccountDto {
  name?: string;
  balance?: number;
  ownerUserIds?: string[] | null;
  isActive?: boolean;
  bankId?: string | null;
  branchNumber?: string | null;
  accountNumber?: string | null;
}

export const useAccounts = () => {
  const queryClient = useQueryClient();
  const { scope } = useGlobalScope();
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;

  const accountsQuery = useQuery<Account[]>({
    queryKey: ['accounts', activeOrganizationId, scope],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<Account[]>('/accounts', {
        params: { userId: scope }
      });
      return data;
    },
  });

  const createAccount = useMutation({
    mutationFn: async (dto: CreateAccountDto) => {
      const { data } = await apiClient.post<Account>('/accounts', dto);
      return data;
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        void queryClient.invalidateQueries({ queryKey: ['accounts', activeOrganizationId] });
      }
    },
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateAccountDto }) => {
      const { data } = await apiClient.patch<Account>(`/accounts/${id}`, dto);
      return data;
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        void queryClient.invalidateQueries({ queryKey: ['accounts', activeOrganizationId] });
      }
    },
  });

  /** Exclusão definitiva (soft-delete) — só permitida quando a conta não tem dados vivos (409 caso contrário). */
  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/accounts/${id}`);
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        void queryClient.invalidateQueries({ queryKey: ['accounts', activeOrganizationId] });
      }
    },
  });

  return {
    ...accountsQuery,
    accounts: accountsQuery.data ?? [],
    createAccount,
    updateAccount,
    deleteAccount,
  };
};
