import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { fetchIntegrationsStatus } from '@features/platform/api';
import { useIntegrationsQueues } from '@features/platform/useIntegrationsQueues';
import { useWhatsAppAiSettings } from '@features/whatsapp/useWhatsAppAiSettings';
import { useWhatsAppConfig } from '@features/whatsapp/useWhatsAppConfig';
import apiClient from '@shared/lib/apiClient';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardTitle } from '@shared/ui/card';
import { PlatformBullMqQueuesCard } from './PlatformBullMqQueuesCard';

export const PlatformIntegrationsTab = () => {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: ['platform', 'integrations', 'status'],
    queryFn: fetchIntegrationsStatus,
    staleTime: 1000 * 30,
  });
  const queuesQuery = useIntegrationsQueues();
  const config = useWhatsAppConfig();
  const { query: aiSettingsQuery, mutation: aiSettingsMutation } = useWhatsAppAiSettings();

  const providersQuery = useQuery({
    queryKey: ['ai', 'providers'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ id: string; name: string }[]>('/ai/providers');
      return data;
    },
  });

  const refetchAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['platform', 'integrations'] });
    void queryClient.invalidateQueries({ queryKey: ['whatsapp'] });
    void queryClient.invalidateQueries({ queryKey: ['telegram'] });
    void queryClient.invalidateQueries({ queryKey: ['ai', 'providers'] });
  };

  const refetchQueues = () => {
    void queryClient.invalidateQueries({ queryKey: ['platform', 'integrations', 'queues'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={refetchAll} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar tudo
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <CardTitle className="text-base">Estado no servidor</CardTitle>
          {statusQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : statusQuery.isError ? (
            <p className="text-sm text-destructive">Não foi possível obter o estado.</p>
          ) : statusQuery.data ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                <dt className="text-xs text-muted-foreground">RAG</dt>
                <dd className="font-medium text-foreground">
                  {statusQuery.data.ragEnabled ? 'Ativo' : 'Inativo'}
                </dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                <dt className="text-xs text-muted-foreground">MCP</dt>
                <dd className="font-medium text-foreground">
                  {statusQuery.data.mcpConfigured
                    ? `Configurado (${statusQuery.data.mcpServerCount} servidor(es))`
                    : 'Não configurado'}
                </dd>
              </div>
            </dl>
          ) : null}
        </CardContent>
      </Card>

      <PlatformBullMqQueuesCard
        data={queuesQuery.data}
        isLoading={queuesQuery.isLoading}
        isError={queuesQuery.isError}
        onRefresh={refetchQueues}
        isRefreshing={queuesQuery.isFetching}
      />

      {providersQuery.data && providersQuery.data.length > 1 ? (
        <Card>
          <CardContent className="space-y-4 p-5">
            <CardTitle className="text-base">IA no WhatsApp</CardTitle>
            <p className="text-sm text-muted-foreground">
              Provedor usado para mensagens e comandos desconhecidos (mesmo endpoint que a página
              WhatsApp).
            </p>
            {aiSettingsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">A carregar definições…</p>
            ) : aiSettingsQuery.isError ? (
              <p className="text-sm text-destructive">Falha ao obter definições.</p>
            ) : (
              <div className="flex items-center gap-4">
                <select
                  disabled={aiSettingsMutation.isPending}
                  value={aiSettingsQuery.data?.provider || ''}
                  onChange={(e) => aiSettingsMutation.mutate(e.target.value)}
                  className="w-full max-w-sm rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-sky-500/50"
                >
                  <option value="" disabled>
                    Selecione o provedor
                  </option>
                  {providersQuery.data.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {aiSettingsMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-sky-400" />
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-3 p-5">
          <CardTitle className="text-base">Configuração pública WhatsApp</CardTitle>
          {config.isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : config.isError ? (
            <p className="text-sm text-destructive">Indisponível.</p>
          ) : config.data ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Sessão</dt>
                <dd className="font-mono text-foreground">{config.data.sessionName}</dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Aparelho</dt>
                <dd className="font-mono text-foreground">{config.data.deviceName}</dd>
              </div>
            </dl>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
