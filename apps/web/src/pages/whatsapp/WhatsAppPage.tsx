import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import QRCode from 'qrcode';
import { motion } from 'framer-motion';
import { MessageCircle, RefreshCw } from 'lucide-react';
import {
  useWhatsAppStatus,
  type WhatsAppHealthResponse,
} from '@features/whatsapp/useWhatsAppStatus';
import { useWhatsAppConfig } from '@features/whatsapp/useWhatsAppConfig';
import { useWhatsAppAiSettings } from '@features/whatsapp/useWhatsAppAiSettings';
import { Card, CardContent, CardTitle } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import apiClient from '@shared/lib/apiClient';
import axios from 'axios';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

const nf = new Intl.NumberFormat('pt-BR');

const sessionLabel: Record<string, string> = {
  unknown: 'Desconhecido',
  qr: 'Aguardando leitura do QR',
  connected: 'Conectado',
  disconnected: 'Desconectado',
};

function WhatsAppQrImage({ raw }: { raw: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setErr(false);
    QRCode.toDataURL(raw, { width: 280, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setErr(true);
      });
    return () => {
      cancelled = true;
    };
  }, [raw]);

  if (err) {
    return (
      <p className="text-sm text-amber-300">
        Não foi possível gerar o QR a partir dos dados da sessão. Use o terminal da API se
        WHATSAPP_QR_TERMINAL estiver ativo.
      </p>
    );
  }
  if (!src) {
    return (
      <div className="flex h-[280px] w-[280px] items-center justify-center rounded-xl border border-white/10 bg-slate-900/50">
        <RefreshCw className="h-8 w-8 animate-spin text-sky-400/60" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="QR code para parear WhatsApp"
      className="rounded-xl border border-white/10 bg-white p-2 shadow-soft-md"
      width={280}
      height={280}
    />
  );
}

function HealthCard({
  data,
  isLoading,
  isError,
  forbidden,
}: {
  data: WhatsAppHealthResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  forbidden: boolean;
}) {
  if (forbidden) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-5">
          <p className="text-sm text-amber-200">
            Apenas utilizadores com perfil de administrador podem consultar o estado do WhatsApp.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <RefreshCw className="h-5 w-5 shrink-0 animate-spin text-sky-400" />
          A carregar estado das filas…
        </CardContent>
      </Card>
    );
  }
  if (isError || !data) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-5 text-sm text-destructive">
          Falha ao consultar o estado do WhatsApp. Confirme que a API e as filas Redis estão
          disponíveis.
        </CardContent>
      </Card>
    );
  }

  const totalWaiting = data.inbound.waiting + data.outbound.waiting;
  const healthy = totalWaiting < 20;

  return (
    <Card
      className={
        healthy
          ? 'border-emerald-500/25 bg-emerald-500/5'
          : 'border-amber-500/40 bg-amber-500/10'
      }
    >
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="mb-2 text-base text-foreground">Filas de mensagens</CardTitle>
            <p className="text-sm text-muted-foreground">
              Inbound — em espera: {nf.format(data.inbound.waiting)} · ativos:{' '}
              {nf.format(data.inbound.active)}
            </p>
            <p className="text-sm text-muted-foreground">
              Outbound — em espera: {nf.format(data.outbound.waiting)} · ativos:{' '}
              {nf.format(data.outbound.active)}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${
              healthy ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-200'
            }`}
          >
            {healthy ? 'Operação normal' : 'Filas elevadas'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SessionCard({ data }: { data: WhatsAppHealthResponse | undefined }) {
  if (!data?.session) return null;
  const { status, lastConnectedAt, lastQr } = data.session;
  const showQr = status === 'qr' && lastQr && lastQr.length > 0;

  let connectedStr = '—';
  if (lastConnectedAt) {
    try {
      connectedStr = format(parseISO(lastConnectedAt), "d MMM yyyy, HH:mm", { locale: ptBR });
    } catch {
      connectedStr = lastConnectedAt;
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <CardTitle className="text-base text-foreground">Sessão Baileys</CardTitle>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Estado</dt>
            <dd className="font-medium text-foreground">{sessionLabel[status] ?? status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Última ligação</dt>
            <dd className="font-medium text-foreground">{connectedStr}</dd>
          </div>
        </dl>
        {showQr ? (
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
            <p className="mb-3 text-sm text-muted-foreground">
              Abra o WhatsApp no telemóvel → Aparelhos ligados → Ligar um aparelho → leia este QR.
            </p>
            <WhatsAppQrImage raw={lastQr!} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export const WhatsAppPage = () => {
  const queryClient = useQueryClient();
  const { activeOrganization } = useActiveOrganization();
  const health = useWhatsAppStatus();
  const config = useWhatsAppConfig();
  const { query: aiSettingsQuery, mutation: aiSettingsMutation } = useWhatsAppAiSettings();

  const { data: providers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['ai', 'providers'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ id: string; name: string }[]>('/ai/providers');
      return data;
    },
  });

  const forbidden =
    axios.isAxiosError(health.error) && health.error.response?.status === 403;
  const canUseWhatsAppAi =
    activeOrganization?.plan === 'pro' || activeOrganization?.plan === 'plus';
  const whatsappAiLimitHint =
    activeOrganization?.plan === 'plus'
      ? 'Limite mensal aproximado: 100.000 mensagens (WhatsApp + Telegram).'
      : activeOrganization?.plan === 'pro'
        ? 'Limite mensal aproximado: 50 mensagens (WhatsApp + Telegram).'
        : 'Plano Free não inclui IA assistente nos canais de mensagens.';

  const refetchAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['whatsapp'] });
  };

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/30 to-sky-500/30 text-emerald-300">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">WhatsApp</h1>
            <p className="text-sm text-muted-foreground">
              Estado da integração Baileys e configuração reportada pelo servidor.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={refetchAll} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </motion.div>

      <HealthCard
        data={health.data}
        isLoading={health.isLoading}
        isError={health.isError}
        forbidden={!!forbidden}
      />

      {!forbidden && health.data ? <SessionCard data={health.data} /> : null}

      {!forbidden && providers.length > 1 ? (
        <Card>
          <CardContent className="space-y-4 p-5">
            <CardTitle className="text-base text-foreground">Configuração da Inteligência Artificial</CardTitle>
            <p className="text-sm text-muted-foreground">
              Selecione qual a inteligência artificial responsável por responder mensagens e comandos desconhecidos do WhatsApp.
            </p>
            <p className="text-xs text-muted-foreground">{whatsappAiLimitHint}</p>
            {!canUseWhatsAppAi ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-200">
                Recurso indisponível no plano atual. Faça upgrade para Pro ou Plus para ativar IA no
                WhatsApp.
              </p>
            ) : null}
            {aiSettingsQuery.isLoading ? (
               <p className="text-sm text-muted-foreground">A carregar definições…</p>
            ) : aiSettingsQuery.isError ? (
               <p className="text-sm text-destructive">Falha ao obter as configurações (sem permissão ou indisponível).</p>
            ) : (
                <div className="flex items-center gap-4">
                  <select
                    disabled={aiSettingsMutation.isPending || !canUseWhatsAppAi}
                    value={aiSettingsQuery.data?.provider || ''}
                    onChange={(e) => aiSettingsMutation.mutate(e.target.value)}
                    className="w-full max-w-sm rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2.5 text-sm font-medium text-foreground focus:border-sky-500/50 outline-none hover:bg-slate-800/50 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    <option value="" disabled>Selecione o provedor padrão</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {aiSettingsMutation.isPending && <RefreshCw className="h-4 w-4 animate-spin text-sky-400" />}
                </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-5">
          <CardTitle className="text-base text-foreground">Configuração no servidor</CardTitle>
          <p className="text-sm text-muted-foreground">
            Valores efetivos (variáveis de ambiente / processo). Para alterar, ajuste o ambiente da
            API e reinicie o serviço.
          </p>
          {config.isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : config.isError ? (
            <p className="text-sm text-destructive">
              Não foi possível obter a configuração (permissões ou API indisponível).
            </p>
          ) : config.data ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-slate-900/30 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Nome da sessão</dt>
                <dd className="font-mono text-foreground">{config.data.sessionName}</dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-900/30 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Nome do aparelho</dt>
                <dd className="font-mono text-foreground">{config.data.deviceName}</dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-900/30 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Reconexão (ms)</dt>
                <dd className="font-mono text-foreground">{config.data.reconnectIntervalMs}</dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-900/30 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Retry (ms)</dt>
                <dd className="font-mono text-foreground">{config.data.retryDelayMs}</dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-900/30 px-3 py-2">
                <dt className="text-xs text-muted-foreground">QR no terminal</dt>
                <dd className="text-foreground">{config.data.printQrInTerminal ? 'Sim' : 'Não'}</dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-900/30 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Namespace credenciais</dt>
                <dd className="font-mono text-foreground">{config.data.authNamespace}</dd>
              </div>
            </dl>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
