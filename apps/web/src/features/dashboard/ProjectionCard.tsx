import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardTitle } from '@shared/ui/card';
import { useFormatter } from '@shared/hooks/useFormatter';
import { useProjections, type DashboardScope } from '@features/dashboard/useDashboard';

interface ProjectionCardProps {
  scope: DashboardScope;
}

const TREND_CONFIG = {
  up: { icon: TrendingUp, className: 'bg-emerald-500/15 text-emerald-400' },
  down: { icon: TrendingDown, className: 'bg-rose-500/15 text-rose-400' },
  flat: { icon: Minus, className: 'bg-slate-500/15 text-slate-300' },
} as const;

export const ProjectionCard = ({ scope }: ProjectionCardProps) => {
  const { t } = useTranslation('dashboard');
  const { formatCurrency } = useFormatter();
  const { data: projection } = useProjections(scope);

  if (!projection) return null;

  const trend = TREND_CONFIG[projection.trend];
  const TrendIcon = trend.icon;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-sky-200/90">
          {t('cards.projection.title')}
        </CardTitle>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${trend.className}`}
        >
          <TrendIcon className="h-3.5 w-3.5" />
          {t(`trend.${projection.trend}`)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{t('cards.projection.income')}</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-emerald-400">
            {formatCurrency(Number(projection.projectedIncome))}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('cards.projection.expense')}</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-rose-400">
            {formatCurrency(Number(projection.projectedExpense))}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('cards.projection.balance')}</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
            {formatCurrency(Number(projection.projectedBalance))}
          </p>
        </div>
      </div>
    </Card>
  );
};
