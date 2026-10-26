import * as React from 'react';
import { cn } from '../utils/cn';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative rounded-[var(--radius-lg)] border border-white/10 bg-gradient-to-br from-card/80 via-card/60 to-card/40 p-4 shadow-soft-md backdrop-blur-xl',
        'before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.32),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.24),transparent_60%)] before:opacity-70',
        'after:pointer-events-none after:absolute after:-inset-px after:rounded-[inherit] after:border after:border-white/5',
        className,
      )}
      {...props}
    />
  ),
);

Card.displayName = 'Card';

type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export const CardHeader = ({ className, ...props }: CardHeaderProps) => (
  <div
    className={cn(
      'mb-3 flex items-center justify-between gap-2',
      className,
    )}
    {...props}
  />
);

type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

export const CardTitle = ({ className, ...props }: CardTitleProps) => (
  <h3
    className={cn(
      'text-sm font-semibold tracking-tight text-foreground/90',
      className,
    )}
    {...props}
  />
);

type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export const CardDescription = ({
  className,
  ...props
}: CardDescriptionProps) => (
  <p
    className={cn('text-xs text-muted-foreground', className)}
    {...props}
  />
);

type CardContentProps = React.HTMLAttributes<HTMLDivElement>;

export const CardContent = ({ className, ...props }: CardContentProps) => (
  <div className={cn('mt-2', className)} {...props} />
);

