import { StatementReconciliationService } from '@app/modules/statement-import/statement-reconciliation.service';
import { TransactionEntity } from '@app/database/entities/transaction.entity';

/**
 * Regressão do BUG-40: o reconciliador derivava o sinal de `direction`, então TODA
 * transferência contava como negativa. A perna 'in' de um resgate RDB (dinheiro
 * voltando para a conta) nunca casava com a linha de income do extrato, e a
 * reimportação de um arquivo sobreposto criava movimento de investimento duplicado.
 */
describe('StatementReconciliationService (transfer legs)', () => {
  const ORG = 'org-1';
  const ACCOUNT = 'acct-1';

  const mkService = (existing: Partial<TransactionEntity>[]) => {
    const getMany = jest.fn().mockResolvedValue(existing);
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany,
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    } as unknown as { createQueryBuilder: jest.Mock };
    const service = new StatementReconciliationService(repository as never);
    return { service, getMany };
  };

  const tx = (over: Partial<TransactionEntity>): TransactionEntity =>
    ({
      id: 'tx-1',
      organizationId: ORG,
      accountId: ACCOUNT,
      direction: 'transfer',
      transferLeg: 'in',
      amount: '100.01',
      description: 'Resgate — RDB-260',
      occurredAt: new Date('2026-10-03T00:00:00.000Z'),
      externalId: null,
      ...over,
    }) as TransactionEntity;

  describe('reconcile', () => {
    it('matches an RDB resgate leg (transfer/in) against the income row of the statement', async () => {
      const leg = tx({ id: 'leg-1', transferLeg: 'in', amount: '100.01' });
      const { service } = mkService([leg]);

      const result = await service.reconcile(ORG, ACCOUNT, [
        {
          occurredAt: '2026-10-03',
          amount: 100.01,
          amountSign: 1 as const,
          description: 'Resgate RDB',
          fitid: 'fitid-resgate-1',
        },
      ]);

      expect(result.counts.new).toBe(0);
      expect(result.counts.likely).toBe(1);
      expect(result.rows[0].duplicateStatus).toBe('duplicate-likely');
      expect(result.rows[0].matchedTransaction?.id).toBe('leg-1');
    });

    it('matches an RDB aporte leg (transfer/out) against the expense row of the statement', async () => {
      const leg = tx({
        id: 'leg-2',
        transferLeg: 'out',
        amount: '100.00',
        description: 'Aporte — RDB-260',
        occurredAt: new Date('2026-10-01T00:00:00.000Z'),
      });
      const { service } = mkService([leg]);

      const result = await service.reconcile(ORG, ACCOUNT, [
        {
          occurredAt: '2026-10-01',
          amount: 100.0,
          amountSign: -1 as const,
          description: 'Aplicação RDB',
          fitid: 'fitid-aporte-1',
        },
      ]);

      expect(result.counts.new).toBe(0);
      expect(result.rows[0].duplicateStatus).toBe('duplicate-likely');
    });

    it('does not match a transfer/out leg against an income row of the same amount', async () => {
      const leg = tx({
        id: 'leg-3',
        transferLeg: 'out',
        amount: '250.00',
        description: 'Aporte — RDB-260',
        occurredAt: new Date('2026-10-01T00:00:00.000Z'),
      });
      const { service } = mkService([leg]);

      const result = await service.reconcile(ORG, ACCOUNT, [
        {
          occurredAt: '2026-10-01',
          amount: 250.0,
          amountSign: 1 as const,
          description: 'Resgate RDB',
          fitid: 'fitid-resgate-2',
        },
      ]);

      expect(result.counts.new).toBe(1);
      expect(result.rows[0].duplicateStatus).toBe('new');
    });

    it('matches by external_id (FITID) when the statement row carries one', async () => {
      const leg = tx({
        id: 'leg-4',
        transferLeg: 'in',
        amount: '500.00',
        description: 'Resgate — RDB-260',
        externalId: 'fitid-resgate-3',
        occurredAt: new Date('2026-10-15T00:00:00.000Z'),
      });
      const { service } = mkService([leg]);

      const result = await service.reconcile(ORG, ACCOUNT, [
        {
          occurredAt: '2026-10-15',
          amount: 500.0,
          amountSign: 1 as const,
          description: 'Resgate RDB',
          fitid: 'fitid-resgate-3',
        },
      ]);

      expect(result.counts.exact).toBe(1);
      expect(result.rows[0].duplicateStatus).toBe('duplicate-exact');
    });
  });
});
