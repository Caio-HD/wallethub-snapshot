import type { QueueHealthStatus } from '@features/platform/api';

export const QUEUE_LABELS: Record<string, string> = {
  whatsappInbound: 'WhatsApp (entrada)',
  whatsappOutbound: 'WhatsApp (saída)',
  telegramInbound: 'Telegram (entrada)',
  telegramOutbound: 'Telegram (saída)',
  projections: 'Projections',
  alerts: 'Alertas',
  investmentQuotes: 'Cotações de investimento',
  notionSync: 'Notion (sync)',
  notionWebhook: 'Notion (webhook)',
};

export const QUEUE_ORDER = Object.keys(QUEUE_LABELS);

const WAITING_WARN_THRESHOLD = 20;

export function queueHealthHint(queue: QueueHealthStatus): 'ok' | 'warn' | 'down' {
  if (queue.status === 'down') return 'down';
  const waiting = queue.counts?.waiting ?? 0;
  const failed = queue.counts?.failed ?? 0;
  if (failed > 0 || waiting >= WAITING_WARN_THRESHOLD) return 'warn';
  return 'ok';
}

export function overallQueueHealth(
  queues: Record<string, QueueHealthStatus>,
): 'ok' | 'warn' | 'down' {
  const hints = Object.values(queues).map(queueHealthHint);
  if (hints.includes('down')) return 'down';
  if (hints.includes('warn')) return 'warn';
  return 'ok';
}
