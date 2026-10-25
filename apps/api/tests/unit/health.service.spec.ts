import { HealthService } from '@app/modules/health/health.service';

const mockQueue = (counts: Record<string, number>) => ({
  getJobCounts: jest.fn().mockResolvedValue(counts),
  client: Promise.resolve({ ping: jest.fn().mockResolvedValue('PONG') }),
});

describe('HealthService.getQueueMetrics', () => {
  it('returns metrics for all registered queues', async () => {
    const counts = { waiting: 2, active: 1, completed: 10, failed: 0, delayed: 0 };
    const service = new HealthService(
      { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as never,
      mockQueue(counts) as never,
      mockQueue(counts) as never,
      mockQueue(counts) as never,
      mockQueue(counts) as never,
      mockQueue(counts) as never,
      mockQueue(counts) as never,
      mockQueue(counts) as never,
      mockQueue(counts) as never,
      mockQueue({ ...counts, failed: 3 }) as never,
    );

    const report = await service.getQueueMetrics();

    expect(report.status).toBe('up');
    expect(report.timestamp).toEqual(expect.any(String));
    expect(Object.keys(report.queues).sort()).toEqual(
      [
        'alerts',
        'investmentQuotes',
        'notionSync',
        'notionWebhook',
        'projections',
        'telegramInbound',
        'telegramOutbound',
        'whatsappInbound',
        'whatsappOutbound',
      ].sort(),
    );
    expect(report.queues.notionWebhook.counts?.failed).toBe(3);
  });

  it('marks report degraded when a queue probe fails', async () => {
    const ok = mockQueue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 });
    const broken = {
      getJobCounts: jest.fn().mockRejectedValue(new Error('redis down')),
      client: Promise.resolve({ ping: jest.fn().mockResolvedValue('PONG') }),
    };
    const service = new HealthService(
      { query: jest.fn() } as never,
      ok as never,
      ok as never,
      broken as never,
      ok as never,
      ok as never,
      ok as never,
      ok as never,
      ok as never,
      ok as never,
    );

    const report = await service.getQueueMetrics();

    expect(report.status).toBe('degraded');
    expect(report.queues.telegramInbound).toEqual({
      status: 'down',
      error: 'redis down',
    });
  });
});
