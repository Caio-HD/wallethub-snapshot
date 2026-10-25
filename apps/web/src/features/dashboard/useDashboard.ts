import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';
import { primaryMonthFromPeriod, sortedYmMonthsFromPeriod } from './periodUtils';

/** 'all' = categorias partilhadas; string = UUID do titular. */
export type DashboardScope = 'all' | string;

export interface DashboardCategory {
  categoryId: string;
  name: string;
  total: number;
  limit?: number;
  percentUsed?: number;
}

export interface MonthlyBudgetDetailRow {
  period: string;
  limit: number;
  spent: number;
}

export interface DashboardSummary {
  period: string;
  scope: DashboardScope;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  topCategories: DashboardCategory[];
  monthlyBudgetLimit?: number | null;
  monthlyBudgetEstimatedIncome?: number | null;
  monthlyBudgetUsed?: number;
  monthlyBudgetDetails?: MonthlyBudgetDetailRow[];
}

export interface Projection {
  id: string;
  periodStart: string;
  periodEnd: string;
  scopeUserId: string | null;
  projectedIncome: string;
  projectedExpense: string;
  projectedBalance: string;
  trend: 'up' | 'flat' | 'down';
  generatedAt: string;
}

export interface CategoryReportItem {
  categoryId: string;
  name: string;
  type: 'income' | 'expense';
  totalIncome: number;
  totalExpense: number;
}

export interface CategoriesReportResponse {
  period: string;
  scope: DashboardScope;
  items: CategoryReportItem[];
}

function scopeParams(scope: DashboardScope): Record<string, string> {
  if (scope === 'all') return {};
  return { userId: scope };
}

/** Filtro adicional do dashboard: conta específica e/ou intervalo por dia. */
export interface DashboardDateFilter {
  accountId?: string;
  range?: { start: string; end: string };
}

/** Params extra (accountId/range) a partir do filtro. */
function filterParams(filter?: DashboardDateFilter): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter?.accountId) params.accountId = filter.accountId;
  if (filter?.range) params.range = `${filter.range.start},${filter.range.end}`;
  return params;
}

/** Fragmento serializado do filtro para o queryKey. */
function filterKey(filter?: DashboardDateFilter): unknown[] {
  return [
    filter?.accountId ?? null,
    filter?.range ? `${filter.range.start},${filter.range.end}` : null,
  ];
}

export const useCategoriesReport = (
  scope: DashboardScope,
  period: string,
  filter?: DashboardDateFilter,
) => {
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;
  return useQuery<CategoriesReportResponse>({
    queryKey: [
      'dashboard',
      activeOrganizationId,
      'categories-report',
      scope,
      period,
      ...filterKey(filter),
    ],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<CategoriesReportResponse>(
        '/dashboard/categories-report',
        { params: { ...scopeParams(scope), period, ...filterParams(filter) } },
      );
      return data;
    },
  });
};

export const useDashboardSummary = (
  scope: DashboardScope,
  period: string,
  filter?: DashboardDateFilter,
) => {
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;
  return useQuery<DashboardSummary>({
    queryKey: [
      'dashboard',
      activeOrganizationId,
      'summary',
      scope,
      period,
      ...filterKey(filter),
    ],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary', {
        params: { ...scopeParams(scope), period, ...filterParams(filter) },
      });
      return data;
    },
  });
};

export interface TopTransactionItem {
  id: string;
  description: string | null;
  amount: number;
  direction: 'income' | 'expense';
  occurredAt: string;
  categoryName: string | null;
  accountName: string | null;
}

export interface TopTransactionsResponse {
  scope: DashboardScope;
  items: TopTransactionItem[];
}

export const useTopTransactions = (
  scope: DashboardScope,
  period: string,
  filter?: DashboardDateFilter,
  limit = 5,
) => {
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;
  return useQuery<TopTransactionsResponse>({
    queryKey: [
      'dashboard',
      activeOrganizationId,
      'top-transactions',
      scope,
      period,
      limit,
      ...filterKey(filter),
    ],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<TopTransactionsResponse>(
        '/dashboard/top-transactions',
        {
          params: {
            ...scopeParams(scope),
            period,
            limit: String(limit),
            ...filterParams(filter),
          },
        },
      );
      return data;
    },
  });
};

export interface EvolutionReportItem {
  period: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  rowKind: 'actual' | 'forecast';
}

export interface EvolutionReportResponse {
  scope: DashboardScope;
  items: EvolutionReportItem[];
}

/** Lista explícita de meses (multi-seleção no picker). */
export interface EvolutionReportExplicitParams {
  periods: string[];
}

/** Janela [anchor − pastMonths … anchor + futureMonths]. */
export interface EvolutionReportRangeParams {
  anchor: string;
  pastMonths?: number;
  futureMonths?: number;
}

export type EvolutionReportHookParams =
  | EvolutionReportExplicitParams
  | EvolutionReportRangeParams
  | { months: number };

/** Com um único mês no picker: janela de `1 + N` meses `[M−N … M]` em `/dashboard/evolution`. */
export const DASHBOARD_EVOLUTION_SINGLE_ANCHOR_PAST_MONTHS = 5;

function evolutionQueryKey(
  organizationId: string | null,
  scope: DashboardScope,
  params: EvolutionReportHookParams,
  filter?: DashboardDateFilter,
): unknown[] {
  const suffix = filterKey(filter);
  if ('periods' in params) {
    return [
      'dashboard',
      organizationId,
      'evolution',
      scope,
      'periods',
      params.periods.join(','),
      ...suffix,
    ];
  }
  if ('anchor' in params) {
    return [
      'dashboard',
      organizationId,
      'evolution',
      scope,
      'range',
      params.anchor,
      params.pastMonths ?? 0,
      params.futureMonths ?? 0,
      ...suffix,
    ];
  }
  return ['dashboard', organizationId, 'evolution', scope, 'legacy', params.months, ...suffix];
}

/** A partir do `period` do dashboard: ≥2 meses → `periods`; senão janela âncora + meses anteriores. */
export function evolutionParamsFromDashboardPeriod(period: string): EvolutionReportHookParams {
  const months = sortedYmMonthsFromPeriod(period);
  if (months.length >= 2) {
    return { periods: months };
  }
  const anchor = months.length === 1 ? months[0] : primaryMonthFromPeriod(period);
  return {
    anchor,
    pastMonths: DASHBOARD_EVOLUTION_SINGLE_ANCHOR_PAST_MONTHS,
    futureMonths: 0,
  };
}

export const useEvolutionReport = (
  scope: DashboardScope,
  params: EvolutionReportHookParams,
  filter?: DashboardDateFilter,
) => {
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;
  return useQuery<EvolutionReportResponse>({
    queryKey: evolutionQueryKey(activeOrganizationId, scope, params, filter),
    enabled: orgQueryReady,
    queryFn: async () => {
      const base = { ...scopeParams(scope), ...filterParams(filter) };
      let query: Record<string, string>;
      if ('periods' in params) {
        query = { ...base, periods: params.periods.join(',') };
      } else if ('anchor' in params) {
        query = {
          ...base,
          anchor: params.anchor,
          pastMonths: String(params.pastMonths ?? 0),
          futureMonths: String(params.futureMonths ?? 0),
          months: '6',
        };
      } else {
        query = { ...base, months: String(params.months) };
      }
      const { data } = await apiClient.get<EvolutionReportResponse>('/dashboard/evolution', {
        params: query,
      });
      return data;
    },
  });
};

export const useProjections = (scope: DashboardScope) => {
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;
  return useQuery<Projection | null>({
    queryKey: ['dashboard', activeOrganizationId, 'projections', scope],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<Projection | null>('/dashboard/projections', {
        params: scopeParams(scope),
      });
      return data;
    },
  });
};

export const useRecalculateDashboard = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useActiveOrganization();
  return useMutation({
    mutationFn: async (scope: DashboardScope) => {
      const userId = scope === 'all' ? undefined : scope;
      const { data } = await apiClient.post<{ success: boolean }>('/dashboard/recalculate', {
        userId,
      });
      return data;
    },
    onSuccess: async () => {
      if (activeOrganizationId) {
        await queryClient.invalidateQueries({ queryKey: ['dashboard', activeOrganizationId] });
      }
    },
  });
};
