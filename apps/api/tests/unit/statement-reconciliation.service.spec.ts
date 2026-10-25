import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StatementReconciliationService, RECONCILE_DATE_WINDOW_DAYS } from '@app/modules/statement-import/statement-reconciliation.service';
import { TransactionEntity } from '@app/database/entities/transaction.entity';
import type { ParsedStatementRow } from '@app/modules/statement-import/statement-import.types';
import { buildStableRowKey } from '@app/modules/statement-import/statement-row-utils';

const ORG = '00000000-0000-0000-0000-000000000001';
const ACC = '00000000-0000-0000-0000-000000000003';
const ACC2 = '00000000-0000-0000-0000-000000000099';

function row(partial: Partial<ParsedStatementRow> & Pick<ParsedStatementRow, 'occurredAt' | 'amount' | 'description'>): ParsedStatementRow {
  return {
    amountSign: partial.amountSign ?? -1,
    ...partial,
  };
}

function mkTx(partial: Partial<TransactionEntity> & Pick<TransactionEntity, 'id' | 'occurredAt' | 'amount' | 'direction'>): TransactionEntity {
  return {
    organizationId: ORG,
    account: { id: ACC } as TransactionEntity['account'],
    description: '',
    externalId: null,
    deletedAt: null,
    ...partial,
  } as TransactionEntity;
}

describe('StatementReconciliationService', () => {
  let service: StatementReconciliationService;
  let candidates: TransactionEntity[];

  beforeEach(async () => {
    candidates = [];
    const moduleRef = await Test.createTestingModule({
      providers: [
        StatementReconciliationService,
        {
          provide: getRepositoryToken(TransactionEntity),
          useValue: {
            // Faithful mock: honor the organization_id/account_id filters the
            // service applies, so account-isolation is actually exercised.
            createQueryBuilder: () => {
              const params: Record<string, unknown> = {};
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const qb: any = {
                where: jest.fn((_sql: string, p?: Record<string, unknown>) => {
                  Object.assign(params, p);
                  return qb;
                }),
                andWhere: jest.fn((_sql: string, p?: Record<string, unknown>) => {
                  Object.assign(params, p);
                  return qb;
                }),
                getMany: jest.fn().mockImplementation(() =>
                  Promise.resolve(
                    candidates.filter(
                      (c) =>
                        c.organizationId === params.organizationId &&
                        c.account?.id === params.accountId,
                    ),
                  ),
                ),
              };
              return qb;
            },
          },
        },
      ],
    }).compile();
    service = moduleRef.get(StatementReconciliationService);
  });

  it('matches exact fitid', async () => {
    candidates = [
      mkTx({
        id: 'tx-exact',
        externalId: 'FIT-001',
        occurredAt: new Date('2025-01-01'),
        amount: '10.00',
        direction: 'expense',
        description: 'Coffee',
      }),
    ];
    const { rows } = await service.reconcile(ORG, ACC, [
      row({ occurredAt: '2025-01-01', amount: 10, description: 'Coffee', fitid: 'FIT-001', amountSign: -1 }),
    ]);
    expect(rows[0].duplicateStatus).toBe('duplicate-exact');
    expect(rows[0].matchedTransaction?.id).toBe('tx-exact');
    expect(rows[0].selectedByDefault).toBe(false);
  });

  it('does not match debit vs credit of same magnitude', async () => {
    candidates = [
      mkTx({
        id: 'tx-debit',
        occurredAt: new Date('2025-01-01'),
        amount: '50.00',
        direction: 'expense',
        description: 'Payment',
      }),
    ];
    const { rows } = await service.reconcile(ORG, ACC, [
      row({ occurredAt: '2025-01-01', amount: 50, description: 'Payment', amountSign: 1 }),
    ]);
    expect(rows[0].duplicateStatus).toBe('new');
  });

  it('matches likely within date window', async () => {
    candidates = [
      mkTx({
        id: 'tx-likely',
        occurredAt: new Date('2025-01-02'),
        amount: '25.50',
        direction: 'expense',
        description: 'Supermarket purchase',
      }),
    ];
    const { rows } = await service.reconcile(ORG, ACC, [
      row({ occurredAt: '2025-01-01', amount: 25.5, description: 'Supermarket purchase', amountSign: -1 }),
    ]);
    expect(rows[0].duplicateStatus).toBe('duplicate-likely');
    expect(rows[0].matchedTransaction?.id).toBe('tx-likely');
  });

  it('does not match outside date window', async () => {
    candidates = [
      mkTx({
        id: 'tx-old',
        occurredAt: new Date('2025-01-01'),
        amount: '25.50',
        direction: 'expense',
        description: 'Supermarket',
      }),
    ];
    const farDate = `2025-01-${String(1 + RECONCILE_DATE_WINDOW_DAYS + 2).padStart(2, '0')}`;
    const { rows } = await service.reconcile(ORG, ACC, [
      row({ occurredAt: farDate, amount: 25.5, description: 'Supermarket', amountSign: -1 }),
    ]);
    expect(rows[0].duplicateStatus).toBe('new');
  });

  it('intra-batch: two rows match one existing tx — only first marks duplicate', async () => {
    candidates = [
      mkTx({
        id: 'tx-one',
        occurredAt: new Date('2025-01-01'),
        amount: '10.00',
        direction: 'expense',
        description: 'Dup',
      }),
    ];
    const { rows } = await service.reconcile(ORG, ACC, [
      row({ occurredAt: '2025-01-01', amount: 10, description: 'Dup A', amountSign: -1 }),
      row({ occurredAt: '2025-01-01', amount: 10, description: 'Dup B', amountSign: -1 }),
    ]);
    const dupCount = rows.filter((r) => r.duplicateStatus === 'duplicate-likely').length;
    expect(dupCount).toBe(1);
    expect(rows.filter((r) => r.duplicateStatus === 'new')).toHaveLength(1);
  });

  it('isolates by account — same fitid different account is new', async () => {
    candidates = [
      mkTx({
        id: 'tx-other-acct',
        externalId: 'FIT-SHARED',
        occurredAt: new Date('2025-01-01'),
        amount: '10.00',
        direction: 'expense',
        description: 'X',
      }),
    ];
    const { rows } = await service.reconcile(ORG, ACC2, [
      row({ occurredAt: '2025-01-01', amount: 10, description: 'X', fitid: 'FIT-SHARED', amountSign: -1 }),
    ]);
    expect(rows[0].duplicateStatus).toBe('new');
  });

  it('tiebreak is deterministic by tx.id', async () => {
    candidates = [
      mkTx({
        id: 'aaa-tx',
        occurredAt: new Date('2025-01-01'),
        amount: '10.00',
        direction: 'expense',
        description: 'Store',
      }),
      mkTx({
        id: 'bbb-tx',
        occurredAt: new Date('2025-01-01'),
        amount: '10.00',
        direction: 'expense',
        description: 'Store',
      }),
    ];
    const { rows } = await service.reconcile(ORG, ACC, [
      row({ occurredAt: '2025-01-01', amount: 10, description: 'Store', amountSign: -1 }),
    ]);
    expect(rows[0].matchedTransaction?.id).toBe('aaa-tx');
  });

  it('buildStableRowKey is stable for same row content', () => {
    const r = row({ occurredAt: '2025-01-01', amount: 10, description: 'Test', fitid: 'F1', amountSign: -1 });
    expect(buildStableRowKey(r)).toBe(buildStableRowKey({ ...r }));
  });
});
