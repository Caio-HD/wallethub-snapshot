import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';
import type { DashboardScope } from '@features/dashboard/useDashboard';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

export interface CategoryBudgetDto {
  id: string;
  categoryId: string;
  scopeUserId: string | null;
  period: string;
  amount: string;
  averageSpent?: number;
}

export interface MonthlyBudgetDto {
  id: string;
  scopeUserId: string | null;
  period: string;
  amount: string;
  estimatedAverageIncome: string | null;
}

function userIdParam(scope: DashboardScope): Record<string, string> {
  if (scope === 'all') return {};
  return { userId: scope };
}

export const useCategoryBudgets = (scope: DashboardScope, period: string) => {
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;
  return useQuery<CategoryBudgetDto[]>({
    queryKey: ['budgets', 'category', activeOrganizationId, scope, period],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<CategoryBudgetDto[]>('/budgets/category', {
        params: { ...userIdParam(scope), period },
      });
      return data;
    },
  });
};

export const useMonthlyBudget = (scope: DashboardScope, period: string) => {
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;
  return useQuery<MonthlyBudgetDto | null>({
    queryKey: ['budgets', 'monthly', activeOrganizationId, scope, period],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<MonthlyBudgetDto | null>('/budgets/monthly', {
        params: { ...userIdParam(scope), period },
      });
      return data;
    },
  });
};

export const useSetCategoryBudget = (_scope: DashboardScope, _period: string) => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useActiveOrganization();
  return useMutation({
    mutationFn: async (payload: {
      categoryId: string;
      userId?: string | null;
      period: string;
      amount: number;
    }) => {
      const { data } = await apiClient.put<CategoryBudgetDto>('/budgets/category', payload);
      return data;
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        queryClient.invalidateQueries({ queryKey: ['budgets', activeOrganizationId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', activeOrganizationId] });
      }
    },
  });
};

export const useSetMonthlyBudget = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useActiveOrganization();
  return useMutation({
    mutationFn: async (payload: {
      userId?: string | null;
      period: string;
      estimatedAverageIncome?: number;
    }) => {
      const { data } = await apiClient.put<MonthlyBudgetDto>('/budgets/monthly', payload);
      return data;
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        queryClient.invalidateQueries({ queryKey: ['budgets', activeOrganizationId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', activeOrganizationId] });
      }
    },
  });
};

export const usePropagateEstimatedIncome = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useActiveOrganization();
  return useMutation({
    mutationFn: async (payload: {
      userId?: string | null;
      fromPeriod: string;
      estimatedAverageIncome: number;
    }) => {
      const { data } = await apiClient.put<{ updated: number }>(
        '/budgets/monthly/propagate-estimated-income',
        payload,
      );
      return data;
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        queryClient.invalidateQueries({ queryKey: ['budgets', activeOrganizationId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', activeOrganizationId] });
      }
    },
  });
};

export const useDeleteCategoryBudget = (scope: DashboardScope, period: string) => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useActiveOrganization();
  return useMutation({
    mutationFn: async (categoryId: string) => {
      await apiClient.delete('/budgets/category', {
        params: { categoryId, ...userIdParam(scope), period },
      });
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        queryClient.invalidateQueries({ queryKey: ['budgets', activeOrganizationId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', activeOrganizationId] });
      }
    },
  });
};
