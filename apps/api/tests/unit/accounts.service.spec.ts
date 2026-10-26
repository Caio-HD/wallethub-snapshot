import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, type Repository } from 'typeorm';
import { AccountsService } from '@app/modules/accounts/accounts.service';
import { AccountEntity } from '@app/database/entities/account.entity';
import { TransactionEntity } from '@app/database/entities/transaction.entity';
import { CategoryEntity } from '@app/database/entities/category.entity';
import { StatementImportBatchEntity } from '@app/database/entities/statement-import-batch.entity';
import { DebtEntity } from '@app/database/entities/debt.entity';

/** Simula uma violação de índice único do Postgres (SQLSTATE 23505) numa constraint. */
const uniqueViolation = (constraint: string) => {
  const err = new QueryFailedError('insert', [], new Error('duplicate key') as Error);
  (err as unknown as { code: string; constraint: string }).code = '23505';
  (err as unknown as { code: string; constraint: string }).constraint = constraint;
  return err;
};

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const ACCOUNT_ID = '00000000-0000-0000-0000-000000000003';

const setup = () => {
  const accountsRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x: object) => x),
    save: jest.fn(async (x: object) => x),
  } as unknown as Repository<AccountEntity>;

  const transactionsRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((x: object) => x),
    save: jest.fn(async (x: object) => x),
  } as unknown as Repository<TransactionEntity>;

  const categoriesRepository = {
    findOne: jest.fn(),
    create: jest.fn((x: object) => x),
    save: jest.fn(async (x: object) => x),
  } as unknown as Repository<CategoryEntity>;

  const batchRepository = {
    count: jest.fn().mockResolvedValue(0),
  } as unknown as Repository<StatementImportBatchEntity>;

  const debtsRepository = {
    count: jest.fn().mockResolvedValue(0),
  } as unknown as Repository<DebtEntity>;

  const service = new AccountsService(
    accountsRepository,
    transactionsRepository,
    categoriesRepository,
    batchRepository,
    debtsRepository,
  );

  return {
    service,
    accountsRepository,
    transactionsRepository,
    categoriesRepository,
    batchRepository,
    debtsRepository,
  };
};

describe('AccountsService', () => {
  describe('findAll', () => {
    it('returns accounts with balances', async () => {
      const { service, accountsRepository, transactionsRepository } = setup();

      const mockAccount = { id: ACCOUNT_ID } as AccountEntity;
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAccount]),
      };
      (accountsRepository.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      (transactionsRepository.find as jest.Mock).mockResolvedValue([
        { amount: '100.00', direction: 'income' },
        { amount: '30.00', direction: 'expense' },
      ]);

      const result = await service.findAll(USER_ID, ORG_ID);

      expect(result).toHaveLength(1);
      expect(result[0].balance).toBe('70.00');
    });

    it('balance counts transfer legs by flow direction (in credits, out debits)', async () => {
      const { service, accountsRepository, transactionsRepository } = setup();

      const mockAccount = { id: ACCOUNT_ID } as AccountEntity;
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAccount]),
      };
      (accountsRepository.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      (transactionsRepository.find as jest.Mock).mockResolvedValue([
        { amount: '100.00', direction: 'income' },
        { amount: '30.00', direction: 'expense' },
        { amount: '50.00', direction: 'transfer', transferLeg: 'in' },
        { amount: '20.00', direction: 'transfer', transferLeg: 'out' },
      ]);

      const result = await service.findAll(USER_ID, ORG_ID);

      // 100 - 30 + 50 - 20 = 100.00
      expect(result[0].balance).toBe('100.00');
    });

    it('applies no user filter when userId is "all"', async () => {
      const { service, accountsRepository } = setup();

      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      (accountsRepository.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.findAll('all', ORG_ID);

      // andWhere for ownerUserIds should not be called for "all"
      const andWhereCalls = (qb.andWhere as jest.Mock).mock.calls.map((c: string[]) => c[0]);
      const hasOwnerFilter = andWhereCalls.some(
        (call: string) => typeof call === 'string' && call.includes('ownerUserIds'),
      );
      expect(hasOwnerFilter).toBe(false);
    });
  });

  describe('create', () => {
    it('creates account without adjustment when balance is zero', async () => {
      const { service, accountsRepository, transactionsRepository } = setup();

      (accountsRepository.save as jest.Mock).mockResolvedValue({
        id: ACCOUNT_ID,
        organizationId: ORG_ID,
      });

      const result = await service.create(
        { name: 'Conta Corrente', ownerUserIds: null },
        USER_ID,
        ORG_ID,
      );

      expect(accountsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Conta Corrente' }),
      );
      expect(transactionsRepository.save).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('creates adjustment transaction when initial balance is provided', async () => {
      const { service, accountsRepository, transactionsRepository, categoriesRepository } = setup();

      (accountsRepository.save as jest.Mock).mockResolvedValue({
        id: ACCOUNT_ID,
        organizationId: ORG_ID,
      });
      (accountsRepository.findOne as jest.Mock).mockResolvedValue({
        id: ACCOUNT_ID,
        organizationId: ORG_ID,
      });
      (categoriesRepository.findOne as jest.Mock).mockResolvedValue(null);
      (categoriesRepository.save as jest.Mock).mockResolvedValue({ id: 'cat-1' });
      (transactionsRepository.save as jest.Mock).mockResolvedValue({});

      await service.create({ name: 'Poupança', balance: 500 }, USER_ID, ORG_ID);

      expect(transactionsRepository.save).toHaveBeenCalled();
    });

    it('creates a NEUTRAL transfer adjustment (out) for negative initial balance', async () => {
      const { service, accountsRepository, transactionsRepository, categoriesRepository } = setup();

      (accountsRepository.save as jest.Mock).mockResolvedValue({
        id: ACCOUNT_ID,
        organizationId: ORG_ID,
      });
      (accountsRepository.findOne as jest.Mock).mockResolvedValue({
        id: ACCOUNT_ID,
        organizationId: ORG_ID,
      });
      (categoriesRepository.findOne as jest.Mock).mockResolvedValue(null);
      (categoriesRepository.save as jest.Mock).mockResolvedValue({ id: 'cat-transfer' });
      (transactionsRepository.save as jest.Mock).mockResolvedValue({});

      await service.create({ name: 'Dívida', balance: -200 }, USER_ID, ORG_ID);

      const txCall = (transactionsRepository.create as jest.Mock).mock.calls[0][0];
      // Ajuste de saldo é NEUTRO: não infla despesa/receita; afeta saldo pelo leg.
      expect(txCall.direction).toBe('transfer');
      expect(txCall.transferLeg).toBe('out');
      expect(txCall.amount).toBe('200.00');
    });

    it('creates a NEUTRAL transfer adjustment (in) for positive initial balance', async () => {
      const { service, accountsRepository, transactionsRepository, categoriesRepository } = setup();

      (accountsRepository.save as jest.Mock).mockResolvedValue({
        id: ACCOUNT_ID,
        organizationId: ORG_ID,
      });
      (accountsRepository.findOne as jest.Mock).mockResolvedValue({
        id: ACCOUNT_ID,
        organizationId: ORG_ID,
      });
      (categoriesRepository.findOne as jest.Mock).mockResolvedValue(null);
      (categoriesRepository.save as jest.Mock).mockResolvedValue({ id: 'cat-transfer' });
      (transactionsRepository.save as jest.Mock).mockResolvedValue({});

      await service.create({ name: 'Poupança', balance: 500 }, USER_ID, ORG_ID);

      const txCall = (transactionsRepository.create as jest.Mock).mock.calls[0][0];
      expect(txCall.direction).toBe('transfer');
      expect(txCall.transferLeg).toBe('in');
      expect(txCall.amount).toBe('500.00');
    });
  });

  describe('update', () => {
    it('throws NotFoundException when account not found', async () => {
      const { service, accountsRepository } = setup();
      (accountsRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update(ACCOUNT_ID, { name: 'Novo' }, USER_ID, ORG_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates account name', async () => {
      const { service, accountsRepository } = setup();
      const account = { id: ACCOUNT_ID, name: 'Antigo', isActive: true } as AccountEntity;
      (accountsRepository.findOne as jest.Mock).mockResolvedValue(account);
      (accountsRepository.save as jest.Mock).mockResolvedValue({ ...account, name: 'Novo' });

      const result = await service.update(ACCOUNT_ID, { name: 'Novo' }, USER_ID, ORG_ID);

      expect(accountsRepository.save).toHaveBeenCalled();
      expect(result.name).toBe('Novo');
    });

    it('creates balance adjustment when balance diff >= 0.01', async () => {
      const { service, accountsRepository, transactionsRepository, categoriesRepository } = setup();
      const account = { id: ACCOUNT_ID, name: 'Conta', organizationId: ORG_ID } as AccountEntity;
      (accountsRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(account) // update findOne
        .mockResolvedValueOnce(account); // createAdjustmentTransaction findOne
      (transactionsRepository.find as jest.Mock).mockResolvedValue([
        { amount: '100.00', direction: 'income' },
      ]);
      (categoriesRepository.findOne as jest.Mock).mockResolvedValue({ id: 'cat-1' });
      (transactionsRepository.save as jest.Mock).mockResolvedValue({});
      (accountsRepository.save as jest.Mock).mockResolvedValue(account);

      await service.update(ACCOUNT_ID, { balance: 150 }, USER_ID, ORG_ID);

      expect(transactionsRepository.save).toHaveBeenCalled();
    });

    it('skips balance adjustment when diff < 0.01', async () => {
      const { service, accountsRepository, transactionsRepository } = setup();
      const account = { id: ACCOUNT_ID, name: 'Conta', organizationId: ORG_ID } as AccountEntity;
      (accountsRepository.findOne as jest.Mock).mockResolvedValue(account);
      (transactionsRepository.find as jest.Mock).mockResolvedValue([
        { amount: '100.00', direction: 'income' },
      ]);
      (accountsRepository.save as jest.Mock).mockResolvedValue(account);

      await service.update(ACCOUNT_ID, { balance: 100.005 }, USER_ID, ORG_ID);

      expect(transactionsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const accountRow = { id: ACCOUNT_ID, organizationId: ORG_ID } as AccountEntity;

    it('throws NotFoundException when account not found', async () => {
      const { service, accountsRepository } = setup();
      (accountsRepository.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.remove(ACCOUNT_ID, ORG_ID, USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('soft-removes when there are no live dependencies', async () => {
      const { service, accountsRepository } = setup();
      (accountsRepository.findOne as jest.Mock).mockResolvedValue(accountRow);
      (accountsRepository as unknown as { softRemove: jest.Mock }).softRemove = jest
        .fn()
        .mockResolvedValue(accountRow);

      await service.remove(ACCOUNT_ID, ORG_ID, USER_ID);

      expect(
        (accountsRepository as unknown as { softRemove: jest.Mock }).softRemove,
      ).toHaveBeenCalledWith(accountRow);
    });

    it.each([
      ['transactions', 'transactionsRepository'],
      ['batches', 'batchRepository'],
      ['debts', 'debtsRepository'],
    ])('throws 409 when there are live %s', async (_label, repoKey) => {
      const ctx = setup();
      (ctx.accountsRepository.findOne as jest.Mock).mockResolvedValue(accountRow);
      (ctx.accountsRepository as unknown as { softRemove: jest.Mock }).softRemove = jest.fn();
      (
        (ctx as unknown as Record<string, { count: jest.Mock }>)[repoKey].count as jest.Mock
      ).mockResolvedValue(3);

      await expect(ctx.service.remove(ACCOUNT_ID, ORG_ID, USER_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(
        (ctx.accountsRepository as unknown as { softRemove: jest.Mock }).softRemove,
      ).not.toHaveBeenCalled();
    });
  });

  describe('findByBankIdentity', () => {
    it('matches by identity WITHOUT filtering isActive (consistente com o índice único)', async () => {
      const { service, accountsRepository } = setup();
      (accountsRepository.findOne as jest.Mock).mockResolvedValue({ id: ACCOUNT_ID });

      await service.findByBankIdentity(ORG_ID, {
        bankId: '260',
        branchNumber: '0001',
        accountNumber: '0257161786',
      });

      const where = (accountsRepository.findOne as jest.Mock).mock.calls[0][0].where;
      expect(where).not.toHaveProperty('isActive');
      // normalização canônica remove zeros à esquerda.
      expect(where).toMatchObject({ branchNumber: '1', accountNumber: '257161786' });
    });

    it('returns null when identity is incomplete', async () => {
      const { service, accountsRepository } = setup();
      const result = await service.findByBankIdentity(ORG_ID, { bankId: '260' });
      expect(result).toBeNull();
      expect(accountsRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('ensureByBankIdentity', () => {
    const identity = {
      name: 'Nubank',
      bankId: '260',
      branchNumber: '1',
      accountNumber: '257161786',
    };

    it('reactivates and returns an existing inactive account', async () => {
      const { service, accountsRepository } = setup();
      const inactive = { id: ACCOUNT_ID, isActive: false } as AccountEntity;
      (accountsRepository.findOne as jest.Mock).mockResolvedValue(inactive);
      (accountsRepository.save as jest.Mock).mockImplementation(async (x: AccountEntity) => x);

      const result = await service.ensureByBankIdentity(ORG_ID, USER_ID, identity);

      expect(result.isActive).toBe(true);
      expect(accountsRepository.create).not.toHaveBeenCalled();
    });

    it('recovers from a concurrent identity unique-violation by reusing the raced account', async () => {
      const { service, accountsRepository } = setup();
      const raced = { id: ACCOUNT_ID, isActive: true } as AccountEntity;
      (accountsRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(null) // pré-check: ainda não existe
        .mockResolvedValueOnce(raced); // após a corrida: outro ficheiro criou
      (accountsRepository.save as jest.Mock).mockRejectedValueOnce(
        uniqueViolation('UQ_account_bank_branch_number'),
      );

      const result = await service.ensureByBankIdentity(ORG_ID, USER_ID, identity);

      expect(result.id).toBe(ACCOUNT_ID);
    });

    it('retries with a suffixed name on name collision', async () => {
      const { service, accountsRepository } = setup();
      (accountsRepository.findOne as jest.Mock).mockResolvedValue(null);
      (accountsRepository.save as jest.Mock)
        .mockRejectedValueOnce(uniqueViolation('UQ_accounts_organization_name'))
        .mockImplementationOnce(async (x: AccountEntity) => ({ ...x, id: ACCOUNT_ID }));

      const result = await service.ensureByBankIdentity(ORG_ID, USER_ID, identity);

      const secondName = (accountsRepository.create as jest.Mock).mock.calls[1][0].name;
      expect(secondName).toMatch(/\(2\)$/);
      expect(result.id).toBe(ACCOUNT_ID);
    });

    it('throws BadRequest when identity is incomplete', async () => {
      const { service } = setup();
      await expect(
        service.ensureByBankIdentity(ORG_ID, USER_ID, { name: 'X', bankId: '260' }),
      ).rejects.toThrow();
    });
  });

  describe('saldo e abertura', () => {
    it('getBalance credits income and transfer-in, debits expense and transfer-out', async () => {
      const { service, transactionsRepository } = setup();
      (transactionsRepository.find as jest.Mock).mockResolvedValue([
        { amount: '100.00', direction: 'income' },
        { amount: '30.00', direction: 'expense' },
        { amount: '50.00', direction: 'transfer', transferLeg: 'in' },
        { amount: '20.00', direction: 'transfer', transferLeg: 'out' },
      ]);

      expect(await service.getBalance(ACCOUNT_ID)).toBe(100);
    });

    it('hasTransactions tells whether the account has live movements', async () => {
      const { service, transactionsRepository } = setup();

      (transactionsRepository.count as jest.Mock).mockResolvedValue(0);
      expect(await service.hasTransactions(ACCOUNT_ID)).toBe(false);

      (transactionsRepository.count as jest.Mock).mockResolvedValue(3);
      expect(await service.hasTransactions(ACCOUNT_ID)).toBe(true);
    });

    it('createOpeningBalance writes a NEUTRAL transfer that credits the account', async () => {
      const { service, accountsRepository, transactionsRepository, categoriesRepository } = setup();
      (accountsRepository.findOne as jest.Mock).mockResolvedValue({
        id: ACCOUNT_ID,
        organizationId: ORG_ID,
      });
      (transactionsRepository.findOne as jest.Mock).mockResolvedValue(null);
      (categoriesRepository.findOne as jest.Mock).mockResolvedValue({ id: 'cat-transfer' });
      (transactionsRepository.save as jest.Mock).mockResolvedValue({});

      const created = await service.createOpeningBalance(
        ACCOUNT_ID,
        11879.42,
        USER_ID,
        'OPENING_BAL_acc',
        new Date('2024-12-31T00:00:00.000Z'),
      );

      expect(created).toBe(true);
      const txCall = (transactionsRepository.create as jest.Mock).mock.calls[0][0];
      expect(txCall.direction).toBe('transfer');
      expect(txCall.transferLeg).toBe('in');
      expect(txCall.amount).toBe('11879.42');
      expect(txCall.description).toBe('Saldo de abertura');
      expect(txCall.externalId).toBe('OPENING_BAL_acc');
    });

    it('createOpeningBalance is idempotent: an existing externalId is not written twice', async () => {
      const { service, transactionsRepository } = setup();
      (transactionsRepository.findOne as jest.Mock).mockResolvedValue({ id: 'tx-1' });

      const created = await service.createOpeningBalance(
        ACCOUNT_ID,
        11879.42,
        USER_ID,
        'OPENING_BAL_acc',
        new Date('2024-12-31T00:00:00.000Z'),
      );

      expect(created).toBe(false);
      expect(transactionsRepository.save).not.toHaveBeenCalled();
    });

    it('createOpeningBalance reports false when the account does not exist', async () => {
      const { service, accountsRepository, transactionsRepository } = setup();
      (transactionsRepository.findOne as jest.Mock).mockResolvedValue(null);
      (accountsRepository.findOne as jest.Mock).mockResolvedValue(null);

      const created = await service.createOpeningBalance(
        ACCOUNT_ID,
        11879.42,
        USER_ID,
        'OPENING_BAL_acc',
        new Date('2024-12-31T00:00:00.000Z'),
      );

      expect(created).toBe(false);
      expect(transactionsRepository.save).not.toHaveBeenCalled();
    });
  });
});
