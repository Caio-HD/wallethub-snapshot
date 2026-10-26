import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
  {
    variants: {
      variant: {
        info: 'bg-primary/15 text-primary border-primary/40',
        success: 'bg-secondary/15 text-secondary border-secondary/40',
        warning: 'bg-amber-500/15 text-amber-300 border-amber-400/40',
        danger: 'bg-destructive/15 text-destructive border-destructive/40',
        neutral: 'bg-muted text-muted-foreground border-muted/60',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <div className={cn(badgeVariants({ variant }), className)} {...props} />
);

