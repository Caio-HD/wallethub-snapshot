import { describe, expect, it } from 'vitest';
import {
  overallQueueHealth,
  queueHealthHint,
} from '@features/platform/platformQueueLabels';
import type { QueueHealthStatus } from '@features/platform/api';

describe('platformQueueLabels', () => {
  const healthy: QueueHealthStatus = {
    status: 'up',
    counts: { waiting: 1, active: 0, completed: 5, failed: 0, delayed: 0 },
  };

  it('queueHealthHint returns ok for low counts', () => {
    expect(queueHealthHint(healthy)).toBe('ok');
  });

  it('queueHealthHint warns on high waiting backlog', () => {
    expect(
      queueHealthHint({
        status: 'up',
        counts: { waiting: 25, active: 0, failed: 0 },
      }),
    ).toBe('warn');
  });

  it('queueHealthHint warns on failed jobs', () => {
    expect(
      queueHealthHint({
        status: 'up',
        counts: { waiting: 0, active: 0, failed: 2 },
      }),
    ).toBe('warn');
  });

  it('overallQueueHealth picks worst hint', () => {
    expect(
      overallQueueHealth({
        a: healthy,
        b: { status: 'down', error: 'x' },
      }),
    ).toBe('down');
    expect(
      overallQueueHealth({
        a: healthy,
        b: {
          status: 'up',
          counts: { waiting: 30, failed: 0 },
        },
      }),
    ).toBe('warn');
    expect(overallQueueHealth({ a: healthy })).toBe('ok');
  });
});
