import { ConflictException, NotFoundException } from '@nestjs/common';
import { StatementImportAuditService } from '@app/modules/statement-import/statement-import-audit.service';
import type { TransactionsService } from '@app/modules/transactions/transactions.service';

const ORG = '00000000-0000-0000-0000-000000000001';
const ACTOR = '00000000-0000-0000-0000-000000000002';
const BATCH = '00000000-0000-0000-0000-000000000010';

describe('StatementImportAuditService.deleteBatch', () => {
  const mkBatchRepo = (batch: unknown) =>
    ({
      findOne: jest.fn().mockResolvedValue(batch),
      softRemove: jest.fn().mockResolvedValue(undefined),
    }) as never;

  const mkTxRepo = (txs: unknown[]) =>
    ({
      find: jest.fn().mockResolvedValue(txs),
    }) as never;

  // Repo de movimentos de investimento (RDB do lote) — vazio por padrão.
  const mkMovementRepo = (movements: unknown[] = []) =>
    ({
      find: jest.fn().mockResolvedValue(movements),
      softRemove: jest.fn().mockResolvedValue(undefined),
    }) as never;

  it('throws NotFound when the batch does not exist', async () => {
    const svc = new StatementImportAuditService(mkBatchRepo(null), mkTxRepo([]), mkMovementRepo(), {
      remove: jest.fn(),
    } as unknown as TransactionsService);
    await expect(svc.deleteBatch(ORG, BATCH, ACTOR)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes transactions and removes the batch when none are debt-linked', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    const batchRepo = mkBatchRepo({ id: BATCH, organizationId: ORG });
    const svc = new StatementImportAuditService(
      batchRepo,
      mkTxRepo([{ id: 'a' }, { id: 'b' }]),
      mkMovementRepo(),
      {
        remove,
      } as unknown as TransactionsService,
    );
    const res = await svc.deleteBatch(ORG, BATCH, ACTOR);
    expect(res.deleted).toBe(2);
    expect(res.skipped).toHaveLength(0);
    expect(res.batchRemoved).toBe(true);
    expect((batchRepo as unknown as { softRemove: jest.Mock }).softRemove).toHaveBeenCalled();
  });

  it('skips debt-linked transactions and keeps the batch', async () => {
    const remove = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ConflictException('Use desfazer pagamento na dívida'));
    const batchRepo = mkBatchRepo({ id: BATCH, organizationId: ORG });
    const svc = new StatementImportAuditService(
      batchRepo,
      mkTxRepo([{ id: 'a' }, { id: 'b', description: 'parcela' }]),
      mkMovementRepo(),
      { remove } as unknown as TransactionsService,
    );
    const res = await svc.deleteBatch(ORG, BATCH, ACTOR);
    expect(res.deleted).toBe(1);
    expect(res.skipped).toEqual([
      { id: 'b', description: 'parcela', reason: 'Use desfazer pagamento na dívida' },
    ]);
    expect(res.batchRemoved).toBe(false);
    expect((batchRepo as unknown as { softRemove: jest.Mock }).softRemove).not.toHaveBeenCalled();
  });

  it('also soft-removes investment movements linked to the batch (RDB)', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    const movementRepo = mkMovementRepo([{ id: 'mov-1' }, { id: 'mov-2' }]);
    const svc = new StatementImportAuditService(
      mkBatchRepo({ id: BATCH, organizationId: ORG }),
      mkTxRepo([{ id: 'a' }]),
      movementRepo,
      { remove } as unknown as TransactionsService,
    );
    const res = await svc.deleteBatch(ORG, BATCH, ACTOR);
    expect(res.batchRemoved).toBe(true);
    expect((movementRepo as unknown as { softRemove: jest.Mock }).softRemove).toHaveBeenCalled();
  });

  it('rethrows unexpected errors', async () => {
    const remove = jest.fn().mockRejectedValue(new Error('db down'));
    const svc = new StatementImportAuditService(
      mkBatchRepo({ id: BATCH, organizationId: ORG }),
      mkTxRepo([{ id: 'a' }]),
      mkMovementRepo(),
      { remove } as unknown as TransactionsService,
    );
    await expect(svc.deleteBatch(ORG, BATCH, ACTOR)).rejects.toThrow('db down');
  });
});
