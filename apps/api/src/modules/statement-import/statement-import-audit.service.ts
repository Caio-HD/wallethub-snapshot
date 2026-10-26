import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StatementImportBatchEntity } from '../../database/entities/statement-import-batch.entity.js';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { InvestmentMovementEntity } from '../../database/entities/investment-movement.entity.js';
import { TransactionsService } from '../transactions/transactions.service';

export type StatementBatchSummary = {
  id: string;
  filename: string;
  format: 'csv' | 'ofx';
  accountId: string;
  detectedBankId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  /** Transações criadas no commit (histórico). */
  transactionCount: number;
  skippedCount: number;
  /** Transações ainda vivas vinculadas ao lote (após exclusões individuais). */
  liveTransactionCount: number;
};

export type StatementBatchTransaction = {
  id: string;
  occurredAt: Date;
  amount: string;
  direction: 'income' | 'expense' | 'transfer';
  description?: string;
  categoryId: string;
  externalId?: string | null;
};

export type DeleteBatchResult = {
  deleted: number;
  /** Transações puladas por estarem ligadas a uma dívida. */
  skipped: Array<{ id: string; description?: string; reason: string }>;
  batchRemoved: boolean;
};

@Injectable()
export class StatementImportAuditService {
  private readonly logger = new Logger(StatementImportAuditService.name);

  constructor(
    @InjectRepository(StatementImportBatchEntity)
    private readonly batchRepo: Repository<StatementImportBatchEntity>,
    @InjectRepository(TransactionEntity)
    private readonly txRepo: Repository<TransactionEntity>,
    @InjectRepository(InvestmentMovementEntity)
    private readonly movementRepo: Repository<InvestmentMovementEntity>,
    private readonly transactionsService: TransactionsService,
  ) {}

  async listBatches(organizationId: string, accountId?: string): Promise<StatementBatchSummary[]> {
    const batches = await this.batchRepo.find({
      where: accountId ? { organizationId, accountId } : { organizationId },
      order: { createdAt: 'DESC' },
    });
    if (batches.length === 0) return [];

    // Contagem viva por lote num único query agrupado (evita N+1).
    const liveRows = await this.txRepo
      .createQueryBuilder('t')
      .select('t.statement_import_batch_id', 'batchId')
      .addSelect('COUNT(*)', 'cnt')
      .where('t.organization_id = :organizationId', { organizationId })
      .andWhere('t.statement_import_batch_id IS NOT NULL')
      .groupBy('t.statement_import_batch_id')
      .getRawMany<{ batchId: string; cnt: string }>();
    const liveByBatch = new Map(liveRows.map((r) => [r.batchId, Number(r.cnt)]));

    return batches.map((b) => ({
      id: b.id,
      filename: b.filename,
      format: b.format,
      accountId: b.accountId,
      detectedBankId: b.detectedBankId,
      createdByUserId: b.createdByUserId,
      createdAt: b.createdAt,
      transactionCount: b.transactionCount,
      skippedCount: b.skippedCount,
      liveTransactionCount: liveByBatch.get(b.id) ?? 0,
    }));
  }

  async getBatch(
    organizationId: string,
    batchId: string,
  ): Promise<{ batch: StatementBatchSummary; transactions: StatementBatchTransaction[] }> {
    const batch = await this.batchRepo.findOne({ where: { id: batchId, organizationId } });
    if (!batch) {
      throw new NotFoundException('Importação não encontrada.');
    }
    const txs = await this.txRepo.find({
      where: { organizationId, statementImportBatchId: batchId },
      order: { occurredAt: 'ASC' },
    });
    return {
      batch: {
        id: batch.id,
        filename: batch.filename,
        format: batch.format,
        accountId: batch.accountId,
        detectedBankId: batch.detectedBankId,
        createdByUserId: batch.createdByUserId,
        createdAt: batch.createdAt,
        transactionCount: batch.transactionCount,
        skippedCount: batch.skippedCount,
        liveTransactionCount: txs.length,
      },
      transactions: txs.map((t) => ({
        id: t.id,
        occurredAt: t.occurredAt,
        amount: t.amount,
        direction: t.direction,
        description: t.description,
        categoryId: (t as unknown as { categoryId?: string }).categoryId ?? '',
        externalId: t.externalId,
      })),
    };
  }

  /**
   * Exclui o lote e suas transações vivas. Transações ligadas a uma dívida são
   * PULADAS (não quebra a dívida) e reportadas. O lote só é removido (soft) ao final.
   */
  async deleteBatch(
    organizationId: string,
    batchId: string,
    actorId: string,
    underImpersonation = false,
  ): Promise<DeleteBatchResult> {
    const batch = await this.batchRepo.findOne({ where: { id: batchId, organizationId } });
    if (!batch) {
      throw new NotFoundException('Importação não encontrada.');
    }
    const txs = await this.txRepo.find({
      where: { organizationId, statementImportBatchId: batchId },
    });

    let deleted = 0;
    const skipped: DeleteBatchResult['skipped'] = [];
    for (const tx of txs) {
      try {
        await this.transactionsService.remove(tx.id, actorId, underImpersonation);
        deleted += 1;
      } catch (e) {
        if (e instanceof ConflictException) {
          skipped.push({ id: tx.id, description: tx.description, reason: e.message });
        } else {
          throw e;
        }
      }
    }

    // Movimentos de investimento criados pelo lote (RDB detectado no OFX): suas transferências de
    // caixa já saíram no loop acima (são transações do lote); aqui removemos os movimentos em si.
    const movements = await this.movementRepo.find({
      where: { organizationId, statementImportBatchId: batchId },
    });
    if (movements.length > 0) {
      await this.movementRepo.softRemove(movements);
    }

    // Só remove o lote quando todas as transações vivas saíram; se sobraram
    // vinculadas a dívidas, mantém o lote para auditoria/retentativa posterior.
    const batchRemoved = skipped.length === 0;
    if (batchRemoved) {
      await this.batchRepo.softRemove(batch);
    }

    this.logger.log(
      JSON.stringify({
        event: 'statement_import_batch_delete',
        batchId,
        deleted,
        skipped: skipped.length,
        batchRemoved,
      }),
    );

    return { deleted, skipped, batchRemoved };
  }
}
