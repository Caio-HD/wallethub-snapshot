import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Download, ExternalLink, ScrollText } from 'lucide-react';
import { exportPlatformAudit, fetchPlatformAudit, type PlatformAuditEntry } from '@features/platform/api';
import { computeAuditDiff } from '@features/platform/auditDiff';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  formatAuditAction,
  formatAuditEntityType,
} from '@features/platform/labels';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Card, CardContent } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { cn } from '@shared/utils/cn';
import { PlatformEmptyState } from './PlatformEmptyState';

export type PlatformNavigate = (next: {
  tab: 'orgs' | 'users';
  orgId?: string;
  userId?: string;
}) => void;

function AuditDiffTable({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  const visible = computeAuditDiff(before, after);
  const changed = visible.filter((r) => r.changed);
  const display = changed.length > 0 ? changed : visible;

  if (display.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem alterações de campos.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[320px] text-left text-xs">
        <thead className="bg-slate-900/60 text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 font-medium">Campo</th>
            <th className="px-2 py-1.5 font-medium">Antes</th>
            <th className="px-2 py-1.5 font-medium">Depois</th>
          </tr>
        </thead>
        <tbody>
          {display.map((row) => (
            <tr key={row.field} className="border-t border-white/5">
              <td className="px-2 py-1.5 text-muted-foreground">{row.label}</td>
              <td
                className={cn(
                  'max-w-[180px] truncate px-2 py-1.5',
                  row.changed && 'text-rose-300/90',
                )}
              >
                {row.before}
              </td>
              <td
                className={cn(
                  'max-w-[180px] truncate px-2 py-1.5',
                  row.changed && 'text-emerald-300/90',
                )}
              >
                {row.after}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditQueryBlock({ query }: { query: Record<string, unknown> }) {
  const rows = Object.entries(query).map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—'),
  }));

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2 text-xs">
      <p className="mb-1 font-medium text-muted-foreground">Parâmetros da leitura</p>
      <dl className="grid gap-1 sm:grid-cols-2">
        {rows.map(({ key, value }) => (
          <div key={key} className="flex gap-2">
            <dt className="text-muted-foreground">{key}:</dt>
            <dd className="truncate text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function EntityLink({
  entry,
  onNavigate,
}: {
  entry: PlatformAuditEntry;
  onNavigate?: PlatformNavigate;
}) {
  const label = entry.entityLabel ?? entry.entityId ?? '—';
  const canLinkOrg = entry.entityType === 'organization' && entry.entityId && onNavigate;
  const canLinkUser = entry.entityType === 'user' && entry.entityId && onNavigate;

  if (canLinkOrg) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-sky-300 hover:underline"
        onClick={() => onNavigate!({ tab: 'orgs', orgId: entry.entityId! })}
      >
        {label}
        <ExternalLink className="h-3 w-3" />
      </button>
    );
  }

  if (canLinkUser) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-sky-300 hover:underline"
        onClick={() => onNavigate!({ tab: 'users', userId: entry.entityId! })}
      >
        {label}
        <ExternalLink className="h-3 w-3" />
      </button>
    );
  }

  return <span>{label}</span>;
}

function AuditEventCard({
  entry,
  onNavigate,
}: {
  entry: PlatformAuditEntry;
  onNavigate?: PlatformNavigate;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = Boolean(entry.before || entry.after);
  const hasQuery = Boolean(entry.query && Object.keys(entry.query).length > 0);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral" className="normal-case">
            {formatAuditAction(entry.action)}
          </Badge>
          <span className="text-foreground">{formatAuditEntityType(entry.entityType)}</span>
          <EntityLink entry={entry} onNavigate={onNavigate} />
          <span className="ml-auto text-xs text-muted-foreground">
            {new Date(entry.createdAt).toLocaleString('pt-PT')}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Operador:{' '}
            {entry.actorUserId && onNavigate ? (
              <button
                type="button"
                className="text-sky-300 hover:underline"
                onClick={() => onNavigate({ tab: 'users', userId: entry.actorUserId! })}
              >
                {entry.actorLabel ?? entry.actorUserId}
              </button>
            ) : (
              (entry.actorLabel ?? entry.actorUserId ?? '—')
            )}
          </span>
          {entry.organizationName || entry.organizationId ? (
            <span>
              Org:{' '}
              {entry.organizationId && onNavigate ? (
                <button
                  type="button"
                  className="text-sky-300 hover:underline"
                  onClick={() => onNavigate({ tab: 'orgs', orgId: entry.organizationId! })}
                >
                  {entry.organizationName ?? entry.organizationId}
                </button>
              ) : (
                (entry.organizationName ?? entry.organizationId)
              )}
            </span>
          ) : null}
        </div>

        {(hasDiff || hasQuery) && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="flex items-center gap-1 self-start text-xs text-sky-300 hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? 'Ocultar detalhe' : 'Ver detalhe'}
            </button>
            {expanded ? (
              <>
                {hasDiff ? <AuditDiffTable before={entry.before} after={entry.after} /> : null}
                {hasQuery && entry.query ? <AuditQueryBlock query={entry.query} /> : null}
              </>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const emptyFilters = {
  entityType: '',
  action: '',
  organizationId: '',
  actorUserId: '',
  from: '',
  to: '',
  q: '',
};

export function PlatformAuditTab({ onNavigate }: { onNavigate?: PlatformNavigate }) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(emptyFilters);
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);
  const deferredQ = useDeferredValue(filters.q);

  const queryParams = {
    page,
    limit: 20,
    entityType: filters.entityType || undefined,
    action: filters.action || undefined,
    organizationId: filters.organizationId || undefined,
    actorUserId: filters.actorUserId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    q: deferredQ.trim() || undefined,
  };

  const exportFilters = {
    entityType: filters.entityType || undefined,
    action: filters.action || undefined,
    organizationId: filters.organizationId || undefined,
    actorUserId: filters.actorUserId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    q: deferredQ.trim() || undefined,
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(format);
    try {
      const date = new Date().toISOString().slice(0, 10);
      if (format === 'json') {
        const result = await exportPlatformAudit({ ...exportFilters, format: 'json' });
        const blob = new Blob([JSON.stringify(result, null, 2)], {
          type: 'application/json;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `platform-audit-${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const blob = await exportPlatformAudit({ ...exportFilters, format: 'csv' });
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `platform-audit-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['platform', 'audit', queryParams],
    queryFn: () => fetchPlatformAudit(queryParams),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const items = data?.items ?? [];
  const hasActiveFilters = Object.values(filters).some((v) => v.trim() !== '');

  const applyFilter = (patch: Partial<typeof emptyFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Exportar eventos com os filtros activos (máx. 5000 linhas).
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exporting !== null}
            onClick={() => handleExport('csv')}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {exporting === 'csv' ? 'A exportar…' : 'CSV'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={exporting !== null}
            onClick={() => handleExport('json')}
          >
            {exporting === 'json' ? 'A exportar…' : 'JSON'}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Pesquisar
          <Input
            placeholder="tipo, operador, org…"
            value={filters.q}
            onChange={(e) => applyFilter({ q: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Tipo de entidade
          <select
            value={filters.entityType}
            onChange={(e) => applyFilter({ entityType: e.target.value })}
            className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {AUDIT_ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {formatAuditEntityType(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Acção
          <select
            value={filters.action}
            onChange={(e) => applyFilter({ action: e.target.value })}
            className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {formatAuditAction(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          ID organização
          <Input
            placeholder="UUID (opcional)"
            value={filters.organizationId}
            onChange={(e) => applyFilter({ organizationId: e.target.value })}
            className="font-mono text-xs"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          ID operador
          <Input
            placeholder="UUID (opcional)"
            value={filters.actorUserId}
            onChange={(e) => applyFilter({ actorUserId: e.target.value })}
            className="font-mono text-xs"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Desde
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => applyFilter({ from: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Até
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => applyFilter({ to: e.target.value })}
          />
        </label>
        {hasActiveFilters ? (
          <div className="flex items-end">
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </div>
        ) : null}
      </div>

      {filters.q !== deferredQ ? (
        <p className="text-xs text-muted-foreground">A procurar…</p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar auditoria…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Não foi possível carregar a auditoria.</p>
      ) : items.length === 0 ? (
        <PlatformEmptyState
          icon={ScrollText}
          title={hasActiveFilters ? 'Nenhum evento encontrado' : 'Sem eventos de auditoria'}
          description={
            hasActiveFilters
              ? 'Ajuste os filtros ou limpe a pesquisa.'
              : 'As acções de escrita no console aparecerão aqui com detalhe before/after.'
          }
          actionLabel={hasActiveFilters ? 'Limpar filtros' : undefined}
          onAction={hasActiveFilters ? clearFilters : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((e) => (
            <AuditEventCard key={e.id} entry={e} onNavigate={onNavigate} />
          ))}
        </div>
      )}

      {data ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {data.total} evento(s) · página {data.page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Seguinte
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
