import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import {
  QUEUE_ALERTS,
  QUEUE_INVESTMENT_QUOTES,
  QUEUE_NOTION_SYNC,
  QUEUE_NOTION_WEBHOOK,
  QUEUE_PROJECTIONS,
  QUEUE_TELEGRAM_INBOUND,
  QUEUE_TELEGRAM_OUTBOUND,
  QUEUE_WHATSAPP_INBOUND,
  QUEUE_WHATSAPP_OUTBOUND,
} from '../../queues';

export interface HealthCheckStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

export interface QueueHealthStatus extends HealthCheckStatus {
  counts?: Record<string, number>;
}

export interface HealthReport {
  status: 'up' | 'degraded';
  timestamp: string;
  checks: {
    api: { status: 'up' };
    database: HealthCheckStatus;
    redis: HealthCheckStatus;
    queues: Record<string, QueueHealthStatus>;
  };
}

export interface QueueMetricsReport {
  status: 'up' | 'degraded';
  timestamp: string;
  queues: Record<string, QueueHealthStatus>;
}

interface QueuesCheckResult {
  status: 'up' | 'down';
  details: Record<string, QueueHealthStatus>;
}

@Injectable()
export class HealthService {
  private readonly queueEntries: Array<[string, Queue]>;

  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue(QUEUE_WHATSAPP_INBOUND) whatsappInboundQueue: Queue,
    @InjectQueue(QUEUE_WHATSAPP_OUTBOUND) whatsappOutboundQueue: Queue,
    @InjectQueue(QUEUE_TELEGRAM_INBOUND) telegramInboundQueue: Queue,
    @InjectQueue(QUEUE_TELEGRAM_OUTBOUND) telegramOutboundQueue: Queue,
    @InjectQueue(QUEUE_PROJECTIONS) projectionsQueue: Queue,
    @InjectQueue(QUEUE_ALERTS) alertsQueue: Queue,
    @InjectQueue(QUEUE_INVESTMENT_QUOTES) investmentQuotesQueue: Queue,
    @InjectQueue(QUEUE_NOTION_SYNC) notionSyncQueue: Queue,
    @InjectQueue(QUEUE_NOTION_WEBHOOK) notionWebhookQueue: Queue,
  ) {
    this.queueEntries = [
      ['whatsappInbound', whatsappInboundQueue],
      ['whatsappOutbound', whatsappOutboundQueue],
      ['telegramInbound', telegramInboundQueue],
      ['telegramOutbound', telegramOutboundQueue],
      ['projections', projectionsQueue],
      ['alerts', alertsQueue],
      ['investmentQuotes', investmentQuotesQueue],
      ['notionSync', notionSyncQueue],
      ['notionWebhook', notionWebhookQueue],
    ];
  }

  async check(): Promise<HealthReport> {
    const [database, redis, queuesResult] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueues(),
    ]);

    const allUp = database.status === 'up' && redis.status === 'up' && queuesResult.status === 'up';

    return {
      status: allUp ? 'up' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        api: { status: 'up' },
        database,
        redis,
        queues: queuesResult.details,
      },
    };
  }

  /** Read-only BullMQ metrics for the platform integrations console (M5). */
  async getQueueMetrics(): Promise<QueueMetricsReport> {
    const queuesResult = await this.checkQueues();
    return {
      status: queuesResult.status === 'up' ? 'up' : 'degraded',
      timestamp: new Date().toISOString(),
      queues: queuesResult.details,
    };
  }

  private async checkDatabase(): Promise<HealthCheckStatus> {
    const started = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (error) {
      return { status: 'down', error: (error as Error).message };
    }
  }

  private async checkRedis(): Promise<HealthCheckStatus> {
    const started = Date.now();
    try {
      const client = await this.queueEntries[0][1].client;
      if (!client) {
        throw new Error('Redis client indisponível');
      }
      const response: string = await client.ping();
      if (response !== 'PONG') {
        throw new Error(`Resposta inesperada do Redis: ${response}`);
      }
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (error) {
      return { status: 'down', error: (error as Error).message };
    }
  }

  private async checkQueues(): Promise<QueuesCheckResult> {
    const details: Record<string, QueueHealthStatus> = {};
    let anyDown = false;

    await Promise.all(
      this.queueEntries.map(async ([label, queue]) => {
        try {
          const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
          );
          details[label] = { status: 'up', counts };
        } catch (error) {
          anyDown = true;
          details[label] = { status: 'down', error: (error as Error).message };
        }
      }),
    );

    return { status: anyDown ? ('down' as const) : ('up' as const), details };
  }
}
