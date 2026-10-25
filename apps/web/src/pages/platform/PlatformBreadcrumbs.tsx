import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { PlatformBreadcrumbItem } from '@features/platform/platformNav';

type PlatformBreadcrumbsProps = {
  items: PlatformBreadcrumbItem[];
};

export function PlatformBreadcrumbs({ items }: PlatformBreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Navegação do console" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
              ) : null}
              {item.to && !isLast ? (
                <Link to={item.to} className="text-sky-300 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span
                  className={isLast ? 'font-medium text-foreground' : undefined}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
