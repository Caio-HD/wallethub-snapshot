import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

export interface StatementBatchSummary {
  id: string;
  filename: string;
  format: 'csv' | 'ofx';
  accountId: string;
  detectedBankId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  transactionCount: number;
  skippedCount: number;
  liveTransactionCount: number;
}

export interface StatementBatchTransaction {
  id: string;
  occurredAt: string;
  amount: string;
  direction: 'income' | 'expense';
  description?: string;
  categoryId: string;
  externalId?: string | null;
}

export interface StatementBatchDetail {
  batch: StatementBatchSummary;
  transactions: StatementBatchTransaction[];
}

export interface DeleteBatchResult {
  deleted: number;
  skipped: Array<{ id: string; description?: string; reason: string }>;
  batchRemoved: boolean;
}

export interface CategoryMapping {
  id: string;
  organizationId: string;
  descriptionKey: string;
  descriptionSample: string;
  categoryId: string;
}

/**
 * Lista de importações (batches). Com `accountId`, filtra pela conta; com
 * `includeAll` (modo geral, sem conta selecionada), lista todos os lotes da org.
 */
export const useStatementBatches = (
  accountId: string | undefined,
  options?: { includeAll?: boolean },
) => {
  const includeAll = options?.includeAll ?? false;
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;

  return useQuery<StatementBatchSummary[]>({
    queryKey: ['statement-batches', activeOrganizationId, accountId ?? '__all__'],
    enabled: orgQueryReady && (Boolean(accountId) || includeAll),
    queryFn: async () => {
      const { data } = await apiClient.get<StatementBatchSummary[]>(
        '/imports/statement/batches',
        { params: accountId ? { accountId } : {} },
      );
      return data;
    },
  });
};

/** Chave de query usada acima — útil para invalidar após import/delete. */
export const statementBatchesQueryKey = (
  organizationId: string | null,
  accountId: string | undefined,
) => ['statement-batches', organizationId, accountId ?? '__all__'] as const;

/** Detalhe de um batch (transações). Só busca quando habilitado. */
export const useStatementBatchDetail = (batchId: string | null) =>
  useQuery<StatementBatchDetail>({
    queryKey: ['statement-batch-detail', batchId],
    enabled: Boolean(batchId),
    queryFn: async () => {
      const { data } = await apiClient.get<StatementBatchDetail>(
        `/imports/statement/batches/${batchId}`,
      );
      return data;
    },
  });

export const useDeleteStatementBatch = () =>
  useMutation({
    mutationFn: async (batchId: string) => {
      const { data } = await apiClient.delete<DeleteBatchResult>(
        `/imports/statement/batches/${batchId}`,
      );
      return data;
    },
  });

/** Mapeamentos de categoria por descrição (auto-categorização de imports). */
export const useCategoryMappings = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;

  const mappingsQuery = useQuery<CategoryMapping[]>({
    queryKey: ['category-mappings', activeOrganizationId],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<CategoryMapping[]>(
        '/imports/statement/category-mappings',
      );
      return data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['category-mappings', activeOrganizationId] });

  const createMapping = useMutation({
    mutationFn: async (dto: { description: string; categoryId: string }) => {
      const { data } = await apiClient.post<CategoryMapping | null>(
        '/imports/statement/category-mappings',
        dto,
      );
      return data;
    },
    onSuccess: () => void invalidate(),
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/imports/statement/category-mappings/${id}`);
    },
    onSuccess: () => void invalidate(),
  });

  return {
    ...mappingsQuery,
    mappings: mappingsQuery.data ?? [],
    createMapping,
    deleteMapping,
  };
};
