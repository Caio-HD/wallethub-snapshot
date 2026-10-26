import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import type { ParsedStatementRow } from './statement-import.types.js';
import { amountKeyFromRow, buildStableRowKey, normalizeExternalId } from './statement-row-utils.js';

export const RECONCILE_DATE_WINDOW_DAYS = 3;

export type DuplicateStatus = 'new' | 'duplicate-exact' | 'duplicate-likely';

export type MatchedTransaction = {
  id: string;
  occurredAt: string;
  amount: number;
  description?: string;
};

export type ReconciledStatementRow = {
  row: ParsedStatementRow;
  rowKey: string;
  duplicateStatus: DuplicateStatus;
  matchedTransaction?: MatchedTransaction;
  selectedByDefault: boolean;
};

export type ReconciliationCounts = {
  exact: number;
  likely: number;
  new: number;
};

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function addDays(iso: string, days: number): Date {
  const d = parseIsoDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function daysBetween(a: string, b: Date): number {
  const da = parseIsoDate(a).getTime();
  const db = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.abs(da - db) / (24 * 60 * 60 * 1000);
}

function txAmountKey(tx: TransactionEntity): number {
  const cents = Math.round(parseFloat(tx.amount) * 100);
  // A perna de transferência tem sinal próprio na conta ('in' credita, 'out' debita), igual a
  // AccountsService.calculateBalance. Tratar toda transferência como negativa fazia a perna 'in'
  // de um resgate RDB nunca casar com a linha de income, duplicando o movimento na reimportação.
  if (tx.direction === 'transfer') {
    return tx.transferLeg === 'in' ? cents : -cents;
  }
  return tx.direction === 'income' ? cents : -cents;
}

function txToIsoDate(tx: TransactionEntity): string {
  const d = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
  return d.toISOString().slice(0, 10);
}

function tokenSetSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

function toMatchedTransaction(tx: TransactionEntity): MatchedTransaction {
  return {
    id: tx.id,
    occurredAt: txToIsoDate(tx),
    amount: parseFloat(tx.amount),
    description: tx.description,
  };
}

@Injectable()
export class StatementReconciliationService {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepository: Repository<TransactionEntity>,
  ) {}

  async reconcile(
    organizationId: string,
    accountId: string,
    rows: ParsedStatementRow[],
  ): Promise<{ rows: ReconciledStatementRow[]; counts: ReconciliationCounts }> {
    if (rows.length === 0) {
      return { rows: [], counts: { exact: 0, likely: 0, new: 0 } };
    }

    const sortedDates = [...rows.map((r) => r.occurredAt)].sort();
    const rangeStart = addDays(sortedDates[0], -RECONCILE_DATE_WINDOW_DAYS);
    const rangeEnd = addDays(sortedDates[sortedDates.length - 1], RECONCILE_DATE_WINDOW_DAYS);
    rangeEnd.setUTCHours(23, 59, 59, 999);

    const candidates = await this.transactionsRepository
      .createQueryBuilder('tx')
      .where('tx.organization_id = :organizationId', { organizationId })
      .andWhere('tx.account_id = :accountId', { accountId })
      .andWhere('tx.deleted_at IS NULL')
      .andWhere('tx.occurred_at >= :rangeStart', { rangeStart })
      .andWhere('tx.occurred_at <= :rangeEnd', { rangeEnd })
      .getMany();

    const byExternalId = new Map<string, TransactionEntity>();
    for (const tx of candidates) {
      if (tx.externalId) {
        byExternalId.set(tx.externalId, tx);
      }
    }

    const sortedRows = [...rows].sort((a, b) => {
      const dateCmp = a.occurredAt.localeCompare(b.occurredAt);
      if (dateCmp !== 0) return dateCmp;
      const keyCmp = amountKeyFromRow(a) - amountKeyFromRow(b);
      if (keyCmp !== 0) return keyCmp;
      return a.description.localeCompare(b.description);
    });

    const usedTxIds = new Set<string>();
    const reconciled: ReconciledStatementRow[] = [];
    const counts: ReconciliationCounts = { exact: 0, likely: 0, new: 0 };

    for (const row of sortedRows) {
      const rowKey = buildStableRowKey(row);
      let duplicateStatus: DuplicateStatus = 'new';
      let matched: TransactionEntity | undefined;

      const normalizedFitid = row.fitid ? normalizeExternalId(row.fitid) : undefined;
      if (normalizedFitid) {
        const exact = byExternalId.get(normalizedFitid);
        if (exact && !usedTxIds.has(exact.id)) {
          duplicateStatus = 'duplicate-exact';
          matched = exact;
          usedTxIds.add(exact.id);
        }
      }

      if (!matched) {
        const rowKeyAmount = amountKeyFromRow(row);
        const heuristicCandidates = candidates.filter((tx) => {
          if (usedTxIds.has(tx.id)) return false;
          if (txAmountKey(tx) !== rowKeyAmount) return false;
          return daysBetween(row.occurredAt, tx.occurredAt) <= RECONCILE_DATE_WINDOW_DAYS;
        });

        if (heuristicCandidates.length > 0) {
          heuristicCandidates.sort((a, b) => {
            const dateDiffA = daysBetween(row.occurredAt, a.occurredAt);
            const dateDiffB = daysBetween(row.occurredAt, b.occurredAt);
            if (dateDiffA !== dateDiffB) return dateDiffA - dateDiffB;
            const simA = tokenSetSimilarity(row.description, a.description ?? '');
            const simB = tokenSetSimilarity(row.description, b.description ?? '');
            if (simB !== simA) return simB - simA;
            return a.id.localeCompare(b.id);
          });
          duplicateStatus = 'duplicate-likely';
          matched = heuristicCandidates[0];
          usedTxIds.add(matched.id);
        }
      }

      if (duplicateStatus === 'duplicate-exact') counts.exact += 1;
      else if (duplicateStatus === 'duplicate-likely') counts.likely += 1;
      else counts.new += 1;

      reconciled.push({
        row,
        rowKey,
        duplicateStatus,
        matchedTransaction: matched ? toMatchedTransaction(matched) : undefined,
        selectedByDefault: duplicateStatus === 'new',
      });
    }

    return { rows: reconciled, counts };
  }

  /** Marks later rows in the same batch with identical rowKey as duplicate-likely (cross-file). */
  markIntraBatchDuplicates(reconciled: ReconciledStatementRow[]): {
    rows: ReconciledStatementRow[];
    counts: ReconciliationCounts;
  } {
    const batchSeen = new Set<string>();
    const rows: ReconciledStatementRow[] = [];
    const counts: ReconciliationCounts = { exact: 0, likely: 0, new: 0 };

    for (const rec of reconciled) {
      let next = rec;
      if (rec.duplicateStatus === 'new' && batchSeen.has(rec.rowKey)) {
        next = {
          ...rec,
          duplicateStatus: 'duplicate-likely',
          selectedByDefault: false,
          matchedTransaction: undefined,
        };
      } else if (rec.duplicateStatus === 'new') {
        batchSeen.add(rec.rowKey);
      }

      if (next.duplicateStatus === 'duplicate-exact') counts.exact += 1;
      else if (next.duplicateStatus === 'duplicate-likely') counts.likely += 1;
      else counts.new += 1;
      rows.push(next);
    }

    return { rows, counts };
  }
}
