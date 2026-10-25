import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

export interface Transaction {
  id: string;
  occurredAt: string;
  lockedUntil?: string | null;
  accountId: string;
  categoryId: string;
  userId: string;
  direction: 'income' | 'expense' | 'transfer';
  transferLeg?: 'out' | 'in' | null;
  transferGroupId?: string | null;
  amount: string;
  description?: string;
  source: 'web' | 'whatsapp' | 'telegram';
  category?: {
    id: string;
    name: string;
    type: 'income' | 'expense' | 'transfer';
  };
  account?: {
    id: string;
    name: string;
  };
  attachment?: {
    id: string;
    fileName: string;
    mimeType: string;
  } | null;
}

export interface TransactionFilters {
  period?: { start?: string; end?: string };
  categoryId?: string;
  userId?: string;
  accountId?: string;
}

export interface CreateTransactionPayload {
  occurredAt: string;
  accountId: string;
  categoryId: string;
  amount: number;
  description?: string;
  userId?: string;
  source?: 'web' | 'whatsapp' | 'telegram';
}

export interface UpdateTransactionPayload {
  id: string;
  data: Partial<Omit<CreateTransactionPayload, 'userId' | 'source'>>;
}

/** Transferência (movimento neutro): pareada entre contas (`fromAccountId`+`toAccountId`). */
export interface CreateTransferPayload {
  occurredAt: string;
  amount: number;
  fromAccountId: string;
  toAccountId: string;
  description?: string;
}

const buildQueryParams = (filters: TransactionFilters) => {
  const params: Record<string, string> = {};
  if (filters.categoryId) params.categoryId = filters.categoryId;
  if (filters.userId) params.userId = filters.userId;
  if (filters.accountId) params.accountId = filters.accountId;
  if (filters.period?.start || filters.period?.end) {
    params.range = `${filters.period.start || ''},${filters.period.end || ''}`;
  }
  return params;
};

export const useTransactions = (filters: TransactionFilters) => {
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;
  return useQuery<Transaction[]>({
    queryKey: ['transactions', activeOrganizationId, filters],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<Transaction[]>('/transactions', {
        params: buildQueryParams(filters),
      });
      return data;
    },
  });
};

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useActiveOrganization();
  return useMutation({
    mutationFn: async (payload: CreateTransactionPayload) => {
      const { data } = await apiClient.post<Transaction>('/transactions', payload);
      return data;
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        queryClient.invalidateQueries({ queryKey: ['transactions', activeOrganizationId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', activeOrganizationId] });
      }
    },
  });
};

export const useCreateTransfer = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useActiveOrganization();
  return useMutation({
    mutationFn: async (payload: CreateTransferPayload) => {
      const { data } = await apiClient.post<Transaction[]>('/transactions/transfer', payload);
      return data;
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        queryClient.invalidateQueries({ queryKey: ['transactions', activeOrganizationId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', activeOrganizationId] });
        queryClient.invalidateQueries({ queryKey: ['accounts', activeOrganizationId] });
      }
    },
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useActiveOrganization();
  return useMutation({
    mutationFn: async ({ id, data }: UpdateTransactionPayload) => {
      const response = await apiClient.patch<Transaction>(`/transactions/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        queryClient.invalidateQueries({ queryKey: ['transactions', activeOrganizationId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', activeOrganizationId] });
      }
    },
  });
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useActiveOrganization();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/transactions/${id}`);
      return id;
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        queryClient.invalidateQueries({ queryKey: ['transactions', activeOrganizationId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', activeOrganizationId] });
      }
    },
  });
};
