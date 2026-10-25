import { useMutation, useQuery } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

export interface UncategorizedGroup {
  descriptionKey: string;
  descriptionSample: string;
  direction: 'income' | 'expense';
  count: number;
  totalAmount: string;
  transactionIds: string[];
}

export interface BulkCategorizeResult {
  updated: number;
  skipped: Array<{ id: string; reason: string }>;
}

/**
 * Grupos de transações ainda em "Sem categoria", agrupados por descrição
 * normalizada + direção. Com `accountId`, filtra pela conta; com `includeAll`
 * (modo geral, sem conta selecionada), lista todas as contas da org.
 */
export const useUncategorizedGroups = (
  accountId: string | undefined,
  options?: { includeAll?: boolean },
) => {
  const includeAll = options?.includeAll ?? false;
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;

  return useQuery<UncategorizedGroup[]>({
    queryKey: ['uncategorized', activeOrganizationId, accountId ?? '__all__'],
    enabled: orgQueryReady && (Boolean(accountId) || includeAll),
    queryFn: async () => {
      const { data } = await apiClient.get<UncategorizedGroup[]>('/transactions/uncategorized', {
        params: accountId ? { accountId } : {},
      });
      return data;
    },
  });
};

/** Chave de query usada acima — útil para invalidar após categorizar. */
export const uncategorizedQueryKey = (
  organizationId: string | null,
  accountId: string | undefined,
) => ['uncategorized', organizationId, accountId ?? '__all__'] as const;

export const useBulkCategorize = () =>
  useMutation({
    mutationFn: async (dto: { transactionIds: string[]; categoryId: string }) => {
      const { data } = await apiClient.post<BulkCategorizeResult>(
        '/transactions/bulk-categorize',
        dto,
      );
      return data;
    },
  });
