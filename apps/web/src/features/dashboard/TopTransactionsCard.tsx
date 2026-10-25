import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardTitle } from '@shared/ui/card';
import { useFormatter } from '@shared/hooks/useFormatter';
import {
  useTopTransactions,
  type DashboardDateFilter,
  type DashboardScope,
} from '@features/dashboard/useDashboard';

interface TopTransactionsCardProps {
  scope: DashboardScope;
  period: string;
  filter?: DashboardDateFilter;
}

export const TopTransactionsCard = ({ scope, period, filter }: TopTransactionsCardProps) => {
  const { t } = useTranslation('dashboard');
  const { formatCurrency, formatDate } = useFormatter();
  const { data, isLoading } = useTopTransactions(scope, period, filter);
  const items = data?.items ?? [];

  return (
    <Card className="p-4">
      <CardTitle className="mb-3 text-xs font-semibold uppercase tracking-wide text-sky-200/90">
        {t('cards.topTransactions.title')}
      </CardTitle>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('cards.loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('cards.topTransactions.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const isIncome = item.direction === 'income';
            const subtitle = [item.categoryName, item.accountName]
              .filter(Boolean)
              .join(' • ');
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 border-t border-white/5 pt-2 text-sm first:border-t-0 first:pt-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      isIncome
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    {isIncome ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownLeft className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-foreground/90">
                      {item.description ?? t('cards.topTransactions.noDescription')}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {subtitle ? `${subtitle} • ` : ''}
                      {formatDate(item.occurredAt)}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 tabular-nums font-semibold ${
                    isIncome ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatCurrency(item.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};
