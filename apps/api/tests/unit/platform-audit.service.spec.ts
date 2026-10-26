import type { Repository } from 'typeorm';
import type { Counter } from 'prom-client';
import { PlatformAuditService } from '@app/modules/admin/platform-audit.service';
import type { PlatformAuditLogEntity } from '@app/database/entities/platform-audit-log.entity';

describe('PlatformAuditService', () => {
  const makeRepo = (save: jest.Mock) =>
    ({
      create: jest.fn((row: unknown) => row),
      save,
    }) as unknown as Repository<PlatformAuditLogEntity>;

  const makeCounter = () => {
    const inc = jest.fn();
    return { counter: { inc } as unknown as Counter<string>, inc };
  };

  describe('record (best-effort)', () => {
    it('persists the row and does not touch the failure metric on success', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const { counter, inc } = makeCounter();
      const svc = new PlatformAuditService(makeRepo(save), counter);

      await svc.record({ actorUserId: 'a1', action: 'update', entityType: 'user', entityId: 'u1' });

      expect(save).toHaveBeenCalledTimes(1);
      expect(inc).not.toHaveBeenCalled();
    });

    it('never throws on persist failure and increments the alertable counter', async () => {
      const save = jest.fn().mockRejectedValue(new Error('db down'));
      const { counter, inc } = makeCounter();
      const svc = new PlatformAuditService(makeRepo(save), counter);

      await expect(
        svc.record({ actorUserId: 'a1', action: 'create', entityType: 'rag_document' }),
      ).resolves.toBeUndefined();
      expect(inc).toHaveBeenCalledWith({ action: 'create', entity_type: 'rag_document' });
    });
  });

  describe('auditedMutation', () => {
    it('runs loadBefore → mutate → projectAfter → record in order and returns after', async () => {
      const order: string[] = [];
      const save = jest.fn().mockImplementation(() => {
        order.push('record');
        return Promise.resolve(undefined);
      });
      const { counter } = makeCounter();
      const svc = new PlatformAuditService(makeRepo(save), counter);

      const before = { name: 'old' };
      const after = { name: 'new' };
      const result = await svc.auditedMutation(
        { actorUserId: 'a1', action: 'update', entityType: 'user', entityId: 'u1' },
        async () => {
          order.push('loadBefore');
          return before;
        },
        async () => {
          order.push('mutate');
          return { id: 'u1' };
        },
        () => {
          order.push('projectAfter');
          return after;
        },
      );

      expect(order).toEqual(['loadBefore', 'mutate', 'projectAfter', 'record']);
      expect(result).toBe(after);
      const row = save.mock.calls[0][0] as { before: unknown; after: unknown; entityId: string };
      expect(row.before).toBe(before);
      expect(row.after).toBe(after);
      expect(row.entityId).toBe('u1');
    });

    it('resolves entityId as a function after mutate (create case)', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const { counter } = makeCounter();
      const svc = new PlatformAuditService(makeRepo(save), counter);

      await svc.auditedMutation(
        {
          actorUserId: 'a1',
          action: 'create',
          entityType: 'user',
          entityId: (mutated) => (mutated as { id: string }).id,
        },
        async () => null,
        async () => ({ id: 'new-id' }),
        (mutated) => ({ id: (mutated as { id: string }).id }),
      );

      const row = save.mock.calls[0][0] as { entityId: string; before: unknown };
      expect(row.entityId).toBe('new-id');
      expect(row.before).toBeNull();
    });

    it('records the mutation (after=null + projectionError) and rethrows when projectAfter fails', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const mutate = jest.fn().mockResolvedValue({ id: 'u1' });
      const { counter } = makeCounter();
      const svc = new PlatformAuditService(makeRepo(save), counter);
      const boom = new Error('projection blew up');

      await expect(
        svc.auditedMutation(
          { actorUserId: 'a1', action: 'update', entityType: 'user', entityId: 'u1' },
          async () => ({ name: 'old' }),
          mutate,
          () => {
            throw boom;
          },
        ),
      ).rejects.toBe(boom);

      expect(mutate).toHaveBeenCalledTimes(1); // mutation persisted before projection failed
      const row = save.mock.calls[0][0] as { after: unknown; query: unknown };
      expect(row.after).toBeNull();
      expect(row.query).toEqual({ projectionError: true });
    });
  });
});
