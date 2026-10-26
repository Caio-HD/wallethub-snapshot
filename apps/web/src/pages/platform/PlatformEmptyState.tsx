import type { LucideIcon } from 'lucide-react';
import { Button } from '@shared/ui/button';

type PlatformEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const PlatformEmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: PlatformEmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/50 bg-slate-950/30 px-6 py-12 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground">
      <Icon className="h-6 w-6" />
    </span>
    <div className="max-w-sm space-y-1">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    {actionLabel && onAction ? (
      <Button size="sm" onClick={onAction}>
        {actionLabel}
      </Button>
    ) : null}
  </div>
);
