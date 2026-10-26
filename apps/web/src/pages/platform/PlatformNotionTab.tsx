import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { fetchNotionStatus, triggerNotionSync } from '@features/platform/api';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardTitle } from '@shared/ui/card';

const syncOptions = [
  { value: 'transaction', label: 'Transações' },
  { value: 'account', label: 'Contas' },
  { value: 'category', label: 'Categorias' },
  { value: 'projection', label: 'Projeções' },
] as const;

export const PlatformNotionTab = () => {
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState<(typeof syncOptions)[number]['value']>('transaction');

  const statusQuery = useQuery({
    queryKey: ['platform', 'notion', 'status'],
    queryFn: fetchNotionStatus,
  });

  const syncMutation = useMutation({
    mutationFn: () => triggerNotionSync(entityType),
    onSuccess: (data) => {
      toast.success(data.message);
      void queryClient.invalidateQueries({ queryKey: ['platform', 'notion', 'status'] });
    },
    onError: () => {
      toast.error('Falha ao solicitar sincronização do Notion.');
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Estado da integração Notion</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void statusQuery.refetch()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
          {statusQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar estado…</p>
          ) : statusQuery.isError ? (
            <p className="text-sm text-destructive">Não foi possível obter o estado do Notion.</p>
          ) : statusQuery.data ? (
            <>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Ativo</dt>
                  <dd className="font-medium text-foreground">
                    {statusQuery.data.enabled ? 'Sim' : 'Não'}
                  </dd>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Configuração completa</dt>
                  <dd className="font-medium text-foreground">
                    {statusQuery.data.configured ? 'Sim' : 'Não'}
                  </dd>
                </div>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">DB transações</dt>
                  <dd className="font-mono text-foreground">{statusQuery.data.databases.transactions}</dd>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">DB contas</dt>
                  <dd className="font-mono text-foreground">{statusQuery.data.databases.accounts}</dd>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">DB categorias</dt>
                  <dd className="font-mono text-foreground">{statusQuery.data.databases.categories}</dd>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">DB projeções</dt>
                  <dd className="font-mono text-foreground">{statusQuery.data.databases.projections}</dd>
                </div>
              </dl>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <CardTitle className="text-base">Sincronização manual</CardTitle>
          <p className="text-sm text-muted-foreground">
            Dispara um job de sincronização para uma entidade específica.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={entityType}
              onChange={(e) =>
                setEntityType(e.target.value as (typeof syncOptions)[number]['value'])
              }
              className="w-full max-w-xs rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-sky-500/50"
            >
              {syncOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              {syncMutation.isPending ? 'Sincronizando…' : 'Sincronizar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
