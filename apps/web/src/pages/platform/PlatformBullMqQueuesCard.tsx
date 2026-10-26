import { RefreshCw } from 'lucide-react';
import type { IntegrationsQueuesReport, QueueHealthStatus } from '@features/platform/api';
import {
  overallQueueHealth,
  QUEUE_LABELS,
  QUEUE_ORDER,
  queueHealthHint,
} from '@features/platform/platformQueueLabels';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardTitle } from '@shared/ui/card';

const nf = new Intl.NumberFormat('pt-BR');

const hintClass: Record<'ok' | 'warn' | 'down', string> = {
  ok: 'border-emerald-500/30 bg-emerald-950/20',
  warn: 'border-amber-500/30 bg-amber-950/20',
  down: 'border-red-500/40 bg-red-950/20',
};

function QueueRow({ label, queue }: { label: string; queue: QueueHealthStatus }) {
  const hint = queueHealthHint(queue);
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${hintClass[hint]}`}>
      <p className="font-medium text-foreground">{label}</p>
      {queue.status === 'down' ? (
        <p className="mt-1 text-xs text-destructive">{queue.error ?? 'Indisponível'}</p>
      ) : (
        <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-5">
          <div>
            <dt className="inline">Espera: </dt>
            <dd className="inline font-medium text-foreground">{nf.format(queue.counts?.waiting ?? 0)}</dd>
          </div>
          <div>
            <dt className="inline">Activos: </dt>
            <dd className="inline font-medium text-foreground">{nf.format(queue.counts?.active ?? 0)}</dd>
          </div>
          <div>
            <dt className="inline">Atrasados: </dt>
            <dd className="inline font-medium text-foreground">{nf.format(queue.counts?.delayed ?? 0)}</dd>
          </div>
          <div>
            <dt className="inline">Falhas: </dt>
            <dd className="inline font-medium text-foreground">{nf.format(queue.counts?.failed ?? 0)}</dd>
          </div>
          <div>
            <dt className="inline">Concluídos: </dt>
            <dd className="inline font-medium text-foreground">
              {nf.format(queue.counts?.completed ?? 0)}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

export function PlatformBullMqQueuesCard({
  data,
  isLoading,
  isError,
  onRefresh,
  isRefreshing,
}: {
  data: IntegrationsQueuesReport | undefined;
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const overall = data ? overallQueueHealth(data.queues) : null;

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Filas BullMQ</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar filas
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Métricas read-only de todas as filas Redis (WhatsApp, Telegram, projections, alertas,
          cotações, Notion).
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">A carregar filas…</p>
        ) : isError ? (
          <p className="text-sm text-destructive">Não foi possível obter métricas das filas.</p>
        ) : data ? (
          <>
            <p
              className={`text-xs font-medium ${
                overall === 'ok'
                  ? 'text-emerald-300'
                  : overall === 'warn'
                    ? 'text-amber-200'
                    : 'text-red-300'
              }`}
            >
              {overall === 'ok'
                ? 'Operação normal'
                : overall === 'warn'
                  ? 'Atenção — filas elevadas ou jobs falhados'
                  : 'Degradado — uma ou mais filas indisponíveis'}
            </p>
            <div className="space-y-2">
              {QUEUE_ORDER.filter((key) => data.queues[key]).map((key) => (
                <QueueRow key={key} label={QUEUE_LABELS[key] ?? key} queue={data.queues[key]} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Actualizado: {new Date(data.timestamp).toLocaleString('pt-PT')}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
