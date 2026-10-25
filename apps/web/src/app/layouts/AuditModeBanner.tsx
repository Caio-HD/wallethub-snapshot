import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, X } from 'lucide-react';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';
import { Button } from '@shared/ui/button';

/** Aviso de modo auditoria para operador de plataforma (com ou sem org activa). */
export const AuditModeBanner = () => {
  const {
    isPlatformOperator,
    isAuditMode,
    activeOrganizationId,
    activeOrganization,
    organizations,
    clearActiveOrganization,
  } = useActiveOrganization();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (!isPlatformOperator || pathname === '/platform') {
    return null;
  }

  if (isAuditMode && activeOrganization) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/40 bg-sky-500/15 px-4 py-3 text-sm text-sky-100"
        role="status"
      >
        <div className="flex min-w-0 items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden />
          <p>
            <span className="font-medium text-sky-50">Modo auditoria</span>
            {' — '}
            a ver dados de{' '}
            <span className="font-medium text-sky-50">{activeOrganization.name}</span>. Escritas
            financeiras ficam marcadas na trilha de auditoria.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" className="h-8 text-sky-100 hover:bg-sky-500/20" asChild>
            <Link to="/platform?tab=orgs">Console</Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 border-sky-500/30 text-sky-100 hover:bg-sky-500/10"
            onClick={() => {
              clearActiveOrganization();
              navigate('/platform?tab=orgs');
            }}
          >
            <X className="h-3.5 w-3.5" />
            Sair da auditoria
          </Button>
        </div>
      </div>
    );
  }

  if (activeOrganizationId) {
    return null;
  }

  if (organizations.length === 0) {
    return (
      <div
        className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        role="status"
      >
        Nenhuma organização na plataforma. Crie uma em{' '}
        <Link to="/platform" className="font-medium text-amber-50 underline underline-offset-2">
          Console → Organizações
        </Link>
        .
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100"
      role="status"
    >
      Selecione uma organização na barra lateral ou use{' '}
      <Link
        to="/platform?tab=orgs"
        className="font-medium text-sky-50 underline underline-offset-2"
      >
        Console → Abrir como esta org
      </Link>{' '}
      para auditar dados financeiros{' '}
      <span className="font-medium text-sky-50">(modo auditoria)</span>.
    </div>
  );
};
