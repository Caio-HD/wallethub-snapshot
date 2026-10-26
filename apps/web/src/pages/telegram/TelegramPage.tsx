import { useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Send, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardTitle } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { useTelegramStatus } from '@features/telegram/useTelegramStatus';
import { useTelegramConfig } from '@features/telegram/useTelegramConfig';
import { useTelegramLinkCode } from '@features/telegram/useTelegramLinkCode';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

const nf = new Intl.NumberFormat('pt-BR');

export const TelegramPage = () => {
  const queryClient = useQueryClient();
  const { activeOrganization } = useActiveOrganization();
  const health = useTelegramStatus();
  const config = useTelegramConfig();
  const linkMutation = useTelegramLinkCode();
  const [lastLink, setLastLink] = useState<string | null>(null);

  const forbidden = axios.isAxiosError(health.error) && health.error.response?.status === 403;
  const messagingAiLimitHint =
    activeOrganization?.plan === 'plus'
      ? 'Limite mensal aproximado: 100.000 mensagens (WhatsApp + Telegram).'
      : activeOrganization?.plan === 'pro'
        ? 'Limite mensal aproximado: 50 mensagens (WhatsApp + Telegram).'
        : 'Plano Free não inclui IA assistente nos canais de mensagens.';

  const refetchAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['telegram'] });
  };

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-xl font-semibold text-foreground">Telegram</h1>
          <p className="text-sm text-muted-foreground">
            Bot oficial (DM), filas Redis e emparelhamento de conta. A quota de IA partilha-se com o
            WhatsApp.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={refetchAll} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </motion.div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <CardTitle className="text-base">Filas</CardTitle>
          {forbidden ? (
            <p className="text-sm text-amber-200">
              Apenas super administradores podem consultar /telegram/health.
            </p>
          ) : health.isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : health.isError ? (
            <p className="text-sm text-destructive">Falha ao consultar /telegram/health.</p>
          ) : health.data ? (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                Inbound — espera: {nf.format(health.data.inbound.waiting)} · ativos:{' '}
                {nf.format(health.data.inbound.active)}
              </p>
              <p>
                Outbound — espera: {nf.format(health.data.outbound.waiting)} · ativos:{' '}
                {nf.format(health.data.outbound.active)}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <CardTitle className="text-base">Webhook</CardTitle>
          {config.isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar configuração…</p>
          ) : config.isError ? (
            <p className="text-sm text-destructive">Falha ao obter /telegram/config.</p>
          ) : (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Estado:{' '}
                <span className="text-foreground font-medium">
                  {config.data?.webhookConfigured ? 'Token e path configurados' : 'Incompleto'}
                </span>
              </p>
              {config.data?.webhookPathToken ? (
                <p className="break-all font-mono text-xs text-foreground/90">
                  POST …/api/telegram/webhook/{config.data.webhookPathToken}
                </p>
              ) : null}
              <p className="text-xs">
                Defina <code className="text-sky-300">TELEGRAM_WEBHOOK_SECRET</code> e use{' '}
                <code className="text-sky-300">secret_token</code> em{' '}
                <code className="text-sky-300">setWebhook</code> para validar o cabeçalho{' '}
                <code className="text-sky-300">X-Telegram-Bot-Api-Secret-Token</code>.
                {config.data?.webhookSecretConfigured
                  ? ' (Secret configurado na API.)'
                  : ' (Secret opcional.)'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" />
            Ligar o seu Telegram
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Gere um link único e abra-o no Telegram (válido ~15 min). Depois de ligado, pode usar os
            mesmos comandos que no WhatsApp.
          </p>
          <p className="text-xs text-muted-foreground">{messagingAiLimitHint}</p>
          <Button
            type="button"
            variant="primary"
            disabled={linkMutation.isPending}
            onClick={() => {
              linkMutation.mutate(undefined, {
                onSuccess: (data) => {
                  setLastLink(data.deepLink);
                },
              });
            }}
          >
            {linkMutation.isPending ? 'A gerar…' : 'Gerar link de emparelhamento'}
          </Button>
          {linkMutation.isError ? (
            <p className="text-sm text-destructive">
              {(linkMutation.error as Error)?.message ?? 'Falha ao gerar link.'}
            </p>
          ) : null}
          {lastLink ? (
            <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Abra no telemóvel:</p>
              <a
                href={lastLink}
                className="text-sm text-sky-400 break-all underline"
                target="_blank"
                rel="noreferrer"
              >
                {lastLink}
              </a>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
