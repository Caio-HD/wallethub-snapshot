import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';
import { useGlobalScope } from '@shared/context/GlobalScopeContext';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

export interface PortfolioPosition {
  instrumentId: string;
  symbol: string;
  market: string;
  kind: string;
  currency: string;
  displayName: string | null;
  quantity: number;
  averageCost: number;
  totalDividends: number;
  lastPrice: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  asOf: string | null;
  quoteSource: string | null;
}

export interface PortfolioSummary {
  totalCostBasis: number;
  totalMarketValue: number;
  totalUnrealizedPnl: number;
  totalDividends: number;
  baseCurrency: string;
  positions: PortfolioPosition[];
}

export interface PerformanceMetrics {
  twr: number;
  mwr: number;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  alpha: number;
  beta: number;
}

export interface InvestmentPeriodSummary {
  period: string;
  totalBuys: number;
  totalSells: number;
  totalDividends: number;
  buyCount: number;
  sellCount: number;
  dividendCount: number;
  totalMarketValue: number;
  totalUnrealizedPnl: number;
}

export interface InvestmentMovement {
  id: string;
  kind: string;
  quantity: string;
  unitPrice: string;
  fees: string;
  occurredAt: string;
  notes: string | null;
  instrument?: { symbol: string; market: string; kind: string; currency: string };
}

export interface CreateMovementPayload {
  symbol: string;
  market: 'BR' | 'INTL';
  kind: 'stock' | 'fii' | 'etf' | 'fixed_income' | 'other';
  movementKind: 'buy' | 'sell' | 'dividend';
  quantity?: number;
  unitPrice?: number;
  /** Renda fixa: valor em dinheiro do aporte/resgate/rendimento (em vez de quantity × unitPrice). */
  amount?: number;
  /** Conta de caixa: aporte debita / resgate credita o saldo (transferência neutra). */
  accountId?: string;
  fees?: number;
  occurredAt?: string;
  notes?: string;
  quoteSymbol?: string;
  displayName?: string;
}

export function usePortfolio() {
  const { scope } = useGlobalScope();
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;
  return useQuery({
    queryKey: ['investments', activeOrganizationId, 'portfolio', scope],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<PortfolioSummary>(`/investments/portfolio`, {
        params: { userId: scope },
      });
      return data;
    },
  });
}

export function useInvestmentPeriodSummary(period: string) {
  const { scope } = useGlobalScope();
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;
  return useQuery({
    queryKey: ['investments', activeOrganizationId, 'period-summary', scope, period],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<InvestmentPeriodSummary>('/investments/period-summary', {
        params: {
          period,
          ...(scope === 'all' ? {} : { userId: scope }),
        },
      });
      return data;
    },
  });
}

export function useInvestmentMovements() {
  const { scope } = useGlobalScope();
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;
  return useQuery({
    queryKey: ['investments', activeOrganizationId, 'movements', scope],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<InvestmentMovement[]>('/investments/movements', {
        params: { userId: scope }
      });
      return data;
    },
  });
}

export function useCreateInvestmentMovement() {
  const qc = useQueryClient();
  const { activeOrganizationId } = useActiveOrganization();
  return useMutation({
    mutationFn: async (payload: CreateMovementPayload) => {
      const { data } = await apiClient.post<InvestmentMovement>('/investments/movements', payload);
      return data;
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        void qc.invalidateQueries({ queryKey: ['investments', activeOrganizationId] });
      }
    },
  });
}

export function useDeleteInvestmentMovement() {
  const qc = useQueryClient();
  const { activeOrganizationId } = useActiveOrganization();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/investments/movements/${id}`);
    },
    onSuccess: () => {
      if (activeOrganizationId) {
        void qc.invalidateQueries({ queryKey: ['investments', activeOrganizationId] });
      }
    },
  });
}

export function usePerformanceMetrics() {
  const { scope } = useGlobalScope();
  const { activeOrganizationId, isLoadingOrganizations } = useActiveOrganization();
  const orgQueryReady = Boolean(activeOrganizationId) && !isLoadingOrganizations;
  return useQuery({
    queryKey: ['investments', activeOrganizationId, 'metrics', scope],
    enabled: orgQueryReady,
    queryFn: async () => {
      const { data } = await apiClient.get<PerformanceMetrics>(`/investments/analytics`, {
        params: { userId: scope },
      });
      return data;
    },
  });
}
