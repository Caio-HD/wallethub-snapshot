import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { cn } from '@shared/utils/cn';
import { useTranslation } from 'react-i18next';

interface KpiCardProps {
  title: string;
  value: number;
  variation?: number;
  format?: (value: number) => string;
  testId?: string;
}

const getVariationConfig = (variation: number | undefined, stableLabel: string) => {
  if (variation === undefined) {
    return {
      label: stableLabel,
      icon: ArrowRight,
      className: 'text-muted-foreground',
      badgeVariant: 'neutral' as const,
    };
  }
  if (variation > 0) {
    return {
      label: `+${variation.toFixed(1)}%`,
      icon: ArrowUpRight,
      className: 'text-secondary',
      badgeVariant: 'success' as const,
    };
  }
  if (variation < 0) {
    return {
      label: `${variation.toFixed(1)}%`,
      icon: ArrowDownRight,
      className: 'text-destructive',
      badgeVariant: 'danger' as const,
    };
  }
  return {
    label: '0%',
    icon: ArrowRight,
    className: 'text-muted-foreground',
    badgeVariant: 'neutral' as const,
  };
};

export const KpiCard = ({ title, value, variation, format, testId }: KpiCardProps) => {
  const { t } = useTranslation('dashboard');
  const { label, icon: Icon, badgeVariant } = getVariationConfig(variation, t('kpi.stable'));

  const displayValue = format ? format(value) : value.toLocaleString();

  return (
    <Card className="relative overflow-hidden p-0" data-testid={testId}>
      <CardHeader className="mb-1 flex items-center justify-between gap-2 px-4 pt-4">
        <div>
          <CardDescription className="text-[11px] uppercase tracking-[0.14em]">
            {title}
          </CardDescription>
          <CardTitle
            className={cn(
              'mt-1 text-2xl font-semibold leading-tight',
              'bg-gradient-to-r from-sky-300 via-emerald-300 to-indigo-300 bg-clip-text text-transparent',
            )}
          >
            {displayValue}
          </CardTitle>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={badgeVariant} className="flex items-center gap-1">
            <Icon className="h-3 w-3" />
            <span>{label}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900/70">
          <div className="h-full w-2/3 bg-gradient-to-r from-sky-500 via-emerald-400 to-rose-500" />
        </div>
      </CardContent>
    </Card>
  );
};
