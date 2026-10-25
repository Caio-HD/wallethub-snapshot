import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

export type CategoryType = 'income' | 'expense';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  ownerUserId: string | null;
  isActive: boolean;
  sortOrder: number;
  /** Categoria gerida pelo sistema ("Sem categoria") — destino neutro de importações. */
  isSystem?: boolean;
}

export interface CreateCategoryDto {
  name: string;
  type: CategoryType;
  ownerUserId?: string | null;
  sortOrder?: number;
}

export interface UpdateCategoryDto {
  name?: string;
  type?: CategoryType;
  ownerUserId?: string | null;
  sortOrder?: number;
}

export const useCategories = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;

  const categoriesQuery = useQuery<Category[]>({
    queryKey: ['categories', activeOrganizationId],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<Category[]>('/categories');
      return data;
    },
  });

  const createCategory = useMutation({
    mutationFn: async (dto: CreateCategoryDto) => {
      const { data } = await apiClient.post<Category>('/categories', dto);
      return data;
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        void queryClient.invalidateQueries({ queryKey: ['categories', activeOrganizationId] });
      }
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateCategoryDto }) => {
      const { data } = await apiClient.patch<Category>(`/categories/${id}`, dto);
      return data;
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        void queryClient.invalidateQueries({ queryKey: ['categories', activeOrganizationId] });
      }
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/categories/${id}`);
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        void queryClient.invalidateQueries({ queryKey: ['categories', activeOrganizationId] });
      }
    },
  });

  const reorderCategories = useMutation({
    mutationFn: async (categoryIds: string[]) => {
      await apiClient.post('/categories/reorder', { categoryIds });
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        void queryClient.invalidateQueries({ queryKey: ['categories', activeOrganizationId] });
      }
    },
  });

  return {
    ...categoriesQuery,
    categories: categoriesQuery.data ?? [],
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
  };
};
