import { useMemo, useState } from 'react';
import { endOfMonth, format, parse, startOfMonth } from 'date-fns';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { KpiCard } from '@features/dashboard/KpiCard';
import { PeriodPicker } from '@features/dashboard/PeriodPicker';
import { AccountFilter } from '@features/dashboard/AccountFilter';
import { AccountBalancesCard } from '@features/dashboard/AccountBalancesCard';
import { TopTransactionsCard } from '@features/dashboard/TopTransactionsCard';
import { ProjectionCard } from '@features/dashboard/ProjectionCard';
import { CashflowTimelineChart } from '@features/dashboard/CashflowTimelineChart';
import { CategoriesReportVisual } from '@features/dashboard/CategoriesReportVisual';
import { DashboardInvestmentsCard } from '@features/dashboard/DashboardInvestmentsCard';
import { DashboardDebtsCard } from '@features/dashboard/DashboardDebtsCard';
import { useAuth } from '@features/auth/AuthProvider';
import { useGlobalScope } from '@shared/context/GlobalScopeContext';
import {
  useDashboardSummary,
  useCategoriesReport,
  useEvolutionReport,
  useRecalculateDashboard,
  evolutionParamsFromDashboardPeriod,
  type DashboardDateFilter,
} from '@features/dashboard/useDashboard';
import { usePortfolio, useInvestmentPeriodSummary } from '@features/investments/useInvestments';
import apiClient from '@shared/lib/apiClient';
import { Card, CardTitle } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { primaryMonthFromPeriod } from '@features/dashboard/periodUtils';
import { computeKpiVariations } from '@features/dashboard/kpiVariation';
import { useTranslation } from 'react-i18next';
import { useFormatter } from '@shared/hooks/useFormatter';
import { useDateFnsLocale } from '@shared/hooks/useDateFnsLocale';

const currentMonth = format(new Date(), 'yyyy-MM');

export const DashboardPage = () => {
  const { scope } = useGlobalScope();
  const { user } = useAuth();
  const showAdminDebts = user?.role === 'admin' || user?.role === 'super_admin';
  const [period, setPeriod] = useState<string>(currentMonth);
  const [mode, setMode] = useState<'month' | 'range'>('month');
  const [range, setRange] = useState<{ start: string; end: string }>(() => ({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  }));
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const recalculateMutation = useRecalculateDashboard();
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { formatCurrency } = useFormatter();
  const dateFnsLocale = useDateFnsLocale();

  const filter: DashboardDateFilter = useMemo(
    () => ({ accountId, range: mode === 'range' ? range : undefined }),
    [accountId, mode, range],
  );

  /** Mês de referência p/ widgets mensais: no modo intervalo, o mês do fim do intervalo. */
  const monthlyPeriod = useMemo(
    () => (mode === 'range' ? format(new Date(range.end), 'yyyy-MM') : period),
    [mode, range, period],
  );

  const { data: summary, isLoading: isSummaryLoading } = useDashboardSummary(
    scope,
    monthlyPeriod,
    filter,
  );
  const { data: categoriesReport, isLoading: isCategoriesReportLoading } = useCategoriesReport(
    scope,
    monthlyPeriod,
    filter,
  );
  const evolutionQueryParams = useMemo(
    () => evolutionParamsFromDashboardPeriod(monthlyPeriod),
    [monthlyPeriod],
  );
  const highlightPeriod = useMemo(() => primaryMonthFromPeriod(monthlyPeriod), [monthlyPeriod]);
  const { data: evolutionReport, isLoading: isEvolutionLoading } = useEvolutionReport(
    scope,
    evolutionQueryParams,
    filter,
  );
  const { data: invPortfolio, isLoading: isInvPortfolioLoading } = usePortfolio();
  const { data: invPeriod, isLoading: isInvPeriodLoading } =
    useInvestmentPeriodSummary(monthlyPeriod);

  const cashflowChartData = useMemo(() => {
    if (!evolutionReport?.items?.length) return [];
    return evolutionReport.items.map((item) => ({
      month: format(parse(`${item.period}-01`, 'yyyy-MM-dd', new Date()), 'MMM/yy', {
        locale: dateFnsLocale,
      }),
      period: item.period,
      income: item.totalIncome,
      expense: item.totalExpense,
      balance: item.balance,
      rowKind: item.rowKind,
    }));
  }, [evolutionReport, dateFnsLocale]);

  const kpiVariations = useMemo(
    () =>
      summary && mode === 'month'
        ? computeKpiVariations(
            monthlyPeriod,
            {
              totalIncome: summary.totalIncome,
              totalExpense: summary.totalExpense,
              balance: summary.balance,
            },
            evolutionReport?.items ?? [],
          )
        : {},
    [monthlyPeriod, mode, summary, evolutionReport],
  );

  const budgetUsedPctRaw = useMemo(() => {
    if (
      summary?.monthlyBudgetLimit == null ||
      summary.monthlyBudgetLimit <= 0 ||
      summary.monthlyBudgetUsed == null
    ) {
      return null;
    }
    return Math.round((summary.monthlyBudgetUsed / summary.monthlyBudgetLimit) * 100);
  }, [summary]);

  const budgetBarWidthPct =
    budgetUsedPctRaw != null ? Math.min(100, budgetUsedPctRaw) : null;

  const [exportingCsv, setExportingCsv] = useState(false);
  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const safeName =
        mode === 'range'
          ? `${range.start}_${range.end}`
          : primaryMonthFromPeriod(monthlyPeriod);
      const { data } = await apiClient.get<Blob>('/dashboard/export/csv', {
        params: {
          ...(scope === 'all' ? {} : { userId: scope }),
          period: monthlyPeriod,
          includeCategorySummary: 'true',
          ...(accountId ? { accountId } : {}),
          ...(mode === 'range' ? { range: `${range.start},${range.end}` } : {}),
        },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wallethub-${safeName}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  };

  const handleRecalculate = async () => {
    try {
       await recalculateMutation.mutateAsync(scope);
       toast.success(tCommon('toast.dashboardRecalculoSuccess'));
     } catch {
       toast.error(tCommon('toast.dashboardRecalculoError'));
    }
  };

  const showBudgetHero =
    summary?.monthlyBudgetLimit != null && summary.monthlyBudgetLimit > 0 && !isSummaryLoading;

  return (
    <div className="space-y-6" data-testid="dashboard-root">
      {isSummaryLoading && (
        <div data-testid="loading-spinner" className="text-sm text-muted-foreground">
          Carregando…
        </div>
      )}
      <motion.section
        className="flex flex-wrap items-center justify-between gap-4"
        data-testid="dashboard-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <PeriodPicker
            value={period}
            onChange={setPeriod}
            selectionMode="multiple"
            enableRange
            mode={mode}
            onModeChange={setMode}
            range={range}
            onRangeChange={setRange}
          />
          <AccountFilter value={accountId} onChange={setAccountId} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={handleRecalculate}
            disabled={recalculateMutation.isPending}
            variant="outline"
            size="sm"
           >
             {recalculateMutation.isPending ? t('buttons.recalculando') : t('buttons.recalcular')}
           </Button>
          <Button
            type="button"
            onClick={handleExportCsv}
            disabled={exportingCsv}
            variant="glass"
            size="sm"
           >
             {exportingCsv ? t('buttons.exportando') : t('buttons.exportarCSV')}
           </Button>
        </div>
      </motion.section>

      <p data-testid="last-updated" className="sr-only" aria-hidden="true">
        {summary ? format(new Date(), 'yyyy-MM-dd') : ''}
      </p>

      {showBudgetHero && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="relative overflow-hidden border-sky-500/25 bg-gradient-to-br from-sky-500/10 via-slate-950/40 to-emerald-500/10 p-4 shadow-soft-md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                 <CardTitle className="text-xs font-semibold uppercase tracking-wide text-sky-200/90">
                   {t('budget.title')}
                 </CardTitle>
                <div
                  className={`mt-3 grid gap-3 ${summary!.monthlyBudgetEstimatedIncome != null ? 'sm:grid-cols-3' : 'sm:grid-cols-1'}`}
                >
                   {summary!.monthlyBudgetEstimatedIncome != null && (
                     <div>
                       <p className="text-xs text-muted-foreground">{t('budget.estimatedIncome')}</p>
                       <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                         {formatCurrency(summary!.monthlyBudgetEstimatedIncome)}
                       </p>
                     </div>
                   )}
                   <div>
                     <p className="text-xs text-muted-foreground">{t('budget.aggregatedLimit')}</p>
                     <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                       {formatCurrency(summary!.monthlyBudgetLimit!)}
                     </p>
                   </div>
                   {summary!.monthlyBudgetEstimatedIncome != null && (
                     <div>
                       <p className="text-xs text-muted-foreground">{t('budget.difference')}</p>
                       <p
                         className={`mt-0.5 text-lg font-semibold tabular-nums ${
                           summary!.monthlyBudgetEstimatedIncome - summary!.monthlyBudgetLimit! >= 0
                             ? 'text-emerald-400'
                             : 'text-rose-400'
                         }`}
                       >
                         {formatCurrency(
                           summary!.monthlyBudgetEstimatedIncome - summary!.monthlyBudgetLimit!,
                         )}
                       </p>
                     </div>
                   )}
                </div>
                 {summary!.monthlyBudgetUsed != null && budgetUsedPctRaw != null && (
                   <p className="mt-3 text-xs text-muted-foreground">
                     {t('budget.expenses')}:{' '}
                     <span className="font-medium text-foreground/90">
                       {formatCurrency(summary!.monthlyBudgetUsed)}
                     </span>{' '}
                     ({t('budget.limitUsage', { value: budgetUsedPctRaw })}%)
                   </p>
                 )}
              </div>
              <Button type="button" variant="glass" size="sm" asChild>
                <Link to="/budgets">Gerir orçamentos</Link>
              </Button>
            </div>
            {budgetBarWidthPct != null && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-900/80">
                <div
                  className={`h-full rounded-full transition-all ${
                    budgetUsedPctRaw! >= 100
                      ? 'bg-gradient-to-r from-rose-500 to-orange-500'
                      : 'bg-gradient-to-r from-sky-500 to-emerald-400'
                  }`}
                  style={{ width: `${budgetBarWidthPct}%` }}
                />
              </div>
            )}
            {(summary?.monthlyBudgetDetails?.length ?? 0) > 0 && (
              <ul className="mt-3 space-y-2 border-t border-white/10 pt-3">
                {summary!.monthlyBudgetDetails!.map((d) => {
                  const pct = d.limit > 0 ? Math.round((d.spent / d.limit) * 100) : 0;
                  const label = format(
                    parse(`${d.period}-01`, 'yyyy-MM-dd', new Date()),
                    'MMM/yy',
                    { locale: dateFnsLocale },
                  );
                  return (
                    <li
                      key={d.period}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
                    >
                      <span className="font-medium text-foreground/80">{label}</span>
                      <span>
                        {formatCurrency(d.spent)} / {formatCurrency(d.limit)} (
                        {pct}%)
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </motion.section>
      )}

      <motion.section
        className="grid gap-4 md:grid-cols-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
       >
         <KpiCard title={t('kpi.balance')} value={summary?.balance ?? 0} variation={kpiVariations.balancePct} format={formatCurrency} testId="total-balance" />
         <KpiCard
           title={t('kpi.totalIncome')}
           value={summary?.totalIncome ?? 0}
           variation={kpiVariations.incomePct}
           format={formatCurrency}
           testId="monthly-income"
         />
         <KpiCard
           title={t('kpi.totalExpense')}
           value={summary?.totalExpense ?? 0}
           variation={kpiVariations.expensePct}
           format={formatCurrency}
           testId="monthly-expenses"
         />
       </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.section
          className="w-full"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <div data-testid="categories-report-section" className="h-full">
            <CategoriesReportVisual
              items={categoriesReport?.items ?? []}
              isLoading={isCategoriesReportLoading}
            />
          </div>
        </motion.section>

        <motion.section
          className="w-full"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.12 }}
        >
          {isEvolutionLoading ? (
            <Card className="flex h-[32rem] items-center justify-center text-sm text-muted-foreground h-full">
              Carregando…
            </Card>
          ) : (
            <div className="h-full">
              <CashflowTimelineChart
                data={cashflowChartData}
                highlightPeriod={highlightPeriod}
                todayPeriod={currentMonth}
              />
            </div>
          )}
        </motion.section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.13 }}
        >
          <AccountBalancesCard />
        </motion.section>
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.135 }}
        >
          <TopTransactionsCard scope={scope} period={monthlyPeriod} filter={filter} />
        </motion.section>
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.14 }}
        >
          <ProjectionCard scope={scope} />
        </motion.section>
      </div>

      {showAdminDebts && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.14 }}
        >
          <DashboardDebtsCard />
        </motion.section>
      )}

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <DashboardInvestmentsCard
          portfolioValue={invPortfolio?.totalMarketValue ?? 0}
          periodSummary={invPeriod}
          isLoadingPortfolio={isInvPortfolioLoading}
          isLoadingPeriod={isInvPeriodLoading}
        />
      </motion.section>
    </div>
  );
};
