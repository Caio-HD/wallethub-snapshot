import { Eye } from 'lucide-react';
import { Button, type ButtonProps } from '@shared/ui/button';
import { usePlatformImpersonation } from '@features/platform/usePlatformImpersonation';

type PlatformImpersonateButtonProps = {
  organizationId: string;
  organizationName: string;
  size?: NonNullable<ButtonProps['size']>;
  variant?: NonNullable<ButtonProps['variant']>;
  className?: string;
  /** Evita propagação de clique em linhas clicáveis da tabela. */
  stopPropagation?: boolean;
};

export function PlatformImpersonateButton({
  organizationId,
  organizationName,
  size = 'sm',
  variant = 'outline',
  className,
  stopPropagation = false,
}: PlatformImpersonateButtonProps) {
  const { openAsOrganization, isImpersonating } = usePlatformImpersonation();

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className ?? 'gap-1 border-sky-500/40 text-sky-200 hover:bg-sky-500/10'}
      disabled={isImpersonating}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        openAsOrganization(organizationId, organizationName);
      }}
    >
      <Eye className="h-3.5 w-3.5" />
      Abrir como esta org
    </Button>
  );
}
