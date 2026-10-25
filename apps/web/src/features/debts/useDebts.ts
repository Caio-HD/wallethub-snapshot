import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

export type DebtInstallmentStatus = 'pending' | 'paid' | 'skipped';

export interface DebtInstallment {
  id: string;
  sequenceNumber: number;
  dueDate: string;
  amount: string;
  status: DebtInstallmentStatus;
  transactionId: string | null;
  paidAt: string | null;
}

export interface Debt {
  id: string;
  name: string;
  creditor: string | null;
  status: 'active' | 'paid_off' | 'paused';
  principalAmount: string;
  installmentAmount: string;
  totalInstallments: number;
  startDate: string;
  categoryId: string;
  accountId: string | null;
  notes: string | null;
  outstanding: string;
  paidCount: number;
  pendingCount: number;
  nextDueDate: string | null;
  progress: string;
  installments?: DebtInstallment[];
}

export interface DebtSummary {
  activeCount: number;
  totalOutstanding: string;
  dueThisMonth: string;
  dueNext7Days: string;
  nextDueDate: string | null;
  nextDueDebts: Array<{ id: string; name: string; amount: string }>;
}

export interface CreateDebtDto {
  name: string;
  creditor?: string;
  principalAmount: number;
  installmentAmount?: number;
  totalInstallments: number;
  startDate: string;
  categoryId: string;
  accountId?: string;
  notes?: string;
}

export const useDebts = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;

  const debtsQuery = useQuery<Debt[]>({
    queryKey: ['debts', activeOrganizationId],
    enabled: orgReady,
    queryFn: async () => {
      const { data } = await apiClient.get<Debt[]>('/debts');
      return data;
    },
  });

  const summaryQuery = useQuery<DebtSummary>({
    queryKey: ['debts-summary', activeOrganizationId],
    enabled: orgReady,
    queryFn: async () => {
      const { data } = await apiClient.get<DebtSummary>('/debts/summary');
      return data;
    },
  });

  const createDebt = useMutation({
    mutationFn: async (dto: CreateDebtDto) => {
      const { data } = await apiClient.post<Debt>('/debts', dto);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['debts', activeOrganizationId] });
      void queryClient.invalidateQueries({ queryKey: ['debts-summary', activeOrganizationId] });
    },
  });

  const payInstallment = useMutation({
    mutationFn: async ({
      debtId,
      installmentId,
      accountId,
    }: {
      debtId: string;
      installmentId: string;
      accountId?: string;
    }) => {
      const { data } = await apiClient.post<DebtInstallment>(
        `/debts/${debtId}/installments/${installmentId}/pay`,
        { accountId },
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['debts', activeOrganizationId] });
      void queryClient.invalidateQueries({ queryKey: ['debts-summary', activeOrganizationId] });
      void queryClient.invalidateQueries({ queryKey: ['transactions', activeOrganizationId] });
    },
  });

  const unpayInstallment = useMutation({
    mutationFn: async ({ debtId, installmentId }: { debtId: string; installmentId: string }) => {
      const { data } = await apiClient.post<DebtInstallment>(
        `/debts/${debtId}/installments/${installmentId}/unpay`,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['debts', activeOrganizationId] });
      void queryClient.invalidateQueries({ queryKey: ['debts-summary', activeOrganizationId] });
      void queryClient.invalidateQueries({ queryKey: ['transactions', activeOrganizationId] });
    },
  });

  const skipInstallment = useMutation({
    mutationFn: async ({ debtId, installmentId }: { debtId: string; installmentId: string }) => {
      const { data } = await apiClient.post<DebtInstallment>(
        `/debts/${debtId}/installments/${installmentId}/skip`,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['debts', activeOrganizationId] });
      void queryClient.invalidateQueries({ queryKey: ['debts-summary', activeOrganizationId] });
    },
  });

  const payRemaining = useMutation({
    mutationFn: async ({ debtId, accountId }: { debtId: string; accountId?: string }) => {
      const { data } = await apiClient.post<DebtInstallment[]>(`/debts/${debtId}/pay-remaining`, {
        accountId,
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['debts', activeOrganizationId] });
      void queryClient.invalidateQueries({ queryKey: ['debts-summary', activeOrganizationId] });
      void queryClient.invalidateQueries({ queryKey: ['transactions', activeOrganizationId] });
    },
  });

  const removeDebt = useMutation({
    mutationFn: async (debtId: string) => {
      await apiClient.delete(`/debts/${debtId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['debts', activeOrganizationId] });
      void queryClient.invalidateQueries({ queryKey: ['debts-summary', activeOrganizationId] });
    },
  });

  return {
    ...debtsQuery,
    debts: debtsQuery.data ?? [],
    summary: summaryQuery.data,
    isSummaryLoading: summaryQuery.isLoading,
    createDebt,
    payInstallment,
    unpayInstallment,
    skipInstallment,
    payRemaining,
    removeDebt,
  };
};

export const useDebtDetail = (debtId: string | null) => {
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();

  return useQuery<Debt>({
    queryKey: ['debt', activeOrganizationId, debtId],
    enabled: Boolean(activeOrganizationId) && !isLoadingOrganizations && Boolean(debtId),
    queryFn: async () => {
      const { data } = await apiClient.get<Debt>(`/debts/${debtId}`);
      return data;
    },
  });
};
