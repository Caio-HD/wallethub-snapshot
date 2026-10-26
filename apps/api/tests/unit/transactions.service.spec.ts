import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { UpdateTransactionDto } from '@app/modules/transactions/dto/update-transaction.dto';
import type { Queue } from 'bullmq';
import type { Repository } from 'typeorm';
import { TransactionsService } from '@app/modules/transactions/transactions.service';
import { TransactionEntity } from '@app/database/entities/transaction.entity';
import { TransactionAuditEntity } from '@app/database/entities/transaction-audit.entity';
import { CategoryEntity } from '@app/database/entities/category.entity';
import { AccountEntity } from '@app/database/entities/account.entity';
import { UserEntity } from '@app/database/entities/user.entity';
import { DebtInstallmentEntity } from '@app/database/entities/debt-installment.entity';
import { CreateTransactionDto } from '@app/modules/transactions/dto/create-transaction.dto';

const ORG_ID = '00000000-0000-0000-0000-000000000001';

type RepositoryMock<T> = {
  findOne: jest.Mock<Promise<T | null>, [Record<string, unknown>]>;
  find: jest.Mock<Promise<T[]>, [Record<string, unknown>?]>;
  create: jest.Mock<T, [Partial<T>]>;
  save: jest.Mock<Promise<T | T[]>, [T | Partial<T> | T[]]>;
  softRemove: jest.Mock<Promise<T | T[]>, [T | T[]]>;
};

type QueueMock<T> = {
  add: jest.Mock<Promise<void>, [string, T, { removeOnComplete: boolean; removeOnFail: boolean }]>;
};

const createRepositoryMock = <T>(): RepositoryMock<T> => ({
  findOne: jest.fn<Promise<T | null>, [Record<string, unknown>]>(),
  find: jest.fn<Promise<T[]>, [Record<string, unknown>?]>().mockResolvedValue([]),
  create: jest.fn<T, [Partial<T>]>(),
  save: jest.fn<Promise<T | T[]>, [T | Partial<T> | T[]]>(),
  softRemove: jest.fn<Promise<T | T[]>, [T | T[]]>(),
});

describe('TransactionsService', () => {
  const setup = () => {
    const transactionsRepository = createRepositoryMock<TransactionEntity>();
    const auditRepository = {
      create: jest.fn((payload: Partial<TransactionAuditEntity>) => payload),
      save: jest.fn<Promise<TransactionAuditEntity>, [Partial<TransactionAuditEntity>]>(),
    };
    const categoriesRepository = createRepositoryMock<CategoryEntity>();
    const accountsRepository = createRepositoryMock<AccountEntity>();
    const usersRepository = createRepositoryMock<UserEntity>();
    const projectionsQueue: QueueMock<{ transactionId: string }> = {
      add: jest.fn<
        Promise<void>,
        [string, { transactionId: string }, { removeOnComplete: boolean; removeOnFail: boolean }]
      >(),
    };

    const categoryMappings = { upsert: jest.fn().mockResolvedValue(null) };

    const transferCategory = {
      id: 'sys-transfer',
      organizationId: ORG_ID,
      name: 'Transferências',
      type: 'transfer',
      isSystem: true,
    } as unknown as CategoryEntity;
    const categoriesService = {
      ensureSystemCategories: jest.fn().mockResolvedValue({ transfer: transferCategory }),
    };

    const service = new TransactionsService(
      transactionsRepository as unknown as Repository<TransactionEntity>,
      auditRepository as unknown as Repository<TransactionAuditEntity>,
      categoriesRepository as unknown as Repository<CategoryEntity>,
      accountsRepository as unknown as Repository<AccountEntity>,
      usersRepository as unknown as Repository<UserEntity>,
      { exist: jest.fn().mockResolvedValue(false) } as unknown as Repository<DebtInstallmentEntity>,
      projectionsQueue as unknown as Queue<{ transactionId: string }>,
      categoryMappings as unknown as import('@app/modules/statement-import/statement-category-mapping.service').StatementCategoryMappingService,
      categoriesService as unknown as import('@app/modules/categories/categories.service').CategoriesService,
    );

    return {
      service,
      transactionsRepository,
      categoriesRepository,
      accountsRepository,
      usersRepository,
      projectionsQueue,
      auditRepository,
      categoryMappings,
      categoriesService,
      transferCategory,
    };
  };

  it('should create transaction with income direction and enqueue recalculation', async () => {
    const {
      service,
      transactionsRepository,
      categoriesRepository,
      accountsRepository,
      usersRepository,
      projectionsQueue,
    } = setup();

    const now = new Date();
    const nowISO = now.toISOString();
    const category = {
      id: 'cat',
      organizationId: ORG_ID,
      name: 'Test Category',
      type: 'income',
      ownerUserId: null,
      isActive: true,
      sortOrder: 0,
      transactions: [],
      createdAt: now,
      updatedAt: now,
    } as unknown as CategoryEntity;
    const account = {
      id: 'acc',
      organizationId: ORG_ID,
      name: 'Test Account',
      ownerUserIds: null,
      initialBalance: '0',
      isActive: true,
      lastBalanceUpdateAt: null,
      transactions: [],
      createdAt: now,
      updatedAt: now,
    } as unknown as AccountEntity;
    const user = {
      id: 'user',
      email: 'test@example.com',
      username: 'testuser',
      name: 'Test User',
      phoneNumber: '+5511999999999',
      passwordHash: 'hashed',
      isActive: true,
      role: 'admin',
      baseCurrency: 'BRL',
      transactions: [],
      createdAt: now,
      updatedAt: now,
    } as unknown as UserEntity;

    categoriesRepository.findOne.mockResolvedValue(category);
    accountsRepository.findOne.mockResolvedValue(account);
    usersRepository.findOne.mockResolvedValue(user);

    const created = {
      id: 'txn-1',
      organizationId: ORG_ID,
      occurredAt: now,
      account,
      category,
      user,
      direction: 'income',
      amount: '123.45',
      description: 'Receita',
      source: 'web',
      auditLogs: [],
      createdAt: now,
      updatedAt: now,
    } as unknown as TransactionEntity;

    transactionsRepository.create.mockReturnValue(created);
    transactionsRepository.save.mockResolvedValue(created);
    projectionsQueue.add.mockResolvedValue(undefined);

    const dto: CreateTransactionDto = {
      occurredAt: nowISO,
      accountId: 'acc',
      categoryId: 'cat',
      userId: 'user',
      amount: 123.45,
      description: 'Receita',
    };

    const result = await service.create(dto, ORG_ID);

    expect(transactionsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'income',
        amount: '123.45',
        source: 'web',
      }),
    );
    expect(result.id).toBe('txn-1');
    expect(projectionsQueue.add).toHaveBeenCalledWith(
      'recalculate',
      { transactionId: 'txn-1' },
      expect.objectContaining({ removeOnComplete: true }),
    );
  });

  it('should set lockedUntil for WhatsApp transactions', async () => {
    const {
      service,
      transactionsRepository,
      categoriesRepository,
      accountsRepository,
      usersRepository,
    } = setup();
    const now = new Date();
    const nowISO = now.toISOString();
    const category = {
      id: 'cat',
      organizationId: ORG_ID,
      name: 'Test Category',
      type: 'expense',
      ownerUserId: null,
      isActive: true,
      sortOrder: 0,
      transactions: [],
      createdAt: now,
      updatedAt: now,
    } as unknown as CategoryEntity;
    const account = {
      id: 'acc',
      organizationId: ORG_ID,
      name: 'Test Account',
      ownerUserIds: null,
      initialBalance: '0',
      isActive: true,
      lastBalanceUpdateAt: null,
      transactions: [],
      createdAt: now,
      updatedAt: now,
    } as unknown as AccountEntity;
    const user = {
      id: 'user',
      email: 'test@example.com',
      username: 'testuser',
      name: 'Test User',
      phoneNumber: '+5511999999999',
      passwordHash: 'hashed',
      isActive: true,
      role: 'admin',
      baseCurrency: 'BRL',
      transactions: [],
      createdAt: now,
      updatedAt: now,
    } as unknown as UserEntity;

    categoriesRepository.findOne.mockResolvedValue(category);
    accountsRepository.findOne.mockResolvedValue(account);
    usersRepository.findOne.mockResolvedValue(user);

    const created = {
      id: 'txn-2',
      organizationId: ORG_ID,
      occurredAt: now,
      account,
      category,
      user,
      direction: 'expense',
      amount: '50.00',
      source: 'whatsapp',
      lockedUntil: new Date(Date.now() + 2 * 60 * 60 * 1000),
      auditLogs: [],
      createdAt: now,
      updatedAt: now,
    } as unknown as TransactionEntity;

    transactionsRepository.create.mockImplementation((payload) => payload as TransactionEntity);
    transactionsRepository.save.mockResolvedValue(created);

    const dto: CreateTransactionDto = {
      occurredAt: nowISO,
      accountId: 'acc',
      categoryId: 'cat',
      userId: 'user',
      amount: 50,
      source: 'whatsapp',
    };

    await service.create(dto, ORG_ID);
    const createdPayload = transactionsRepository.create.mock.calls[0][0] as TransactionEntity;
    expect(createdPayload.lockedUntil).toBeDefined();
    expect(createdPayload.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it('should throw when userId is missing', async () => {
    const { service } = setup();

    const dto: CreateTransactionDto = {
      occurredAt: new Date().toISOString(),
      accountId: 'acc',
      categoryId: 'cat',
      amount: 10,
    };

    await expect(service.create(dto, ORG_ID)).rejects.toBeInstanceOf(ConflictException);
  });

  it('should throw when category is not found', async () => {
    const { service, categoriesRepository, accountsRepository, usersRepository } = setup();
    const now = new Date();
    categoriesRepository.findOne.mockResolvedValue(null);
    const account = {
      id: 'acc',
      organizationId: ORG_ID,
      name: 'Test Account',
      ownerUserIds: null,
      initialBalance: '0',
      isActive: true,
      lastBalanceUpdateAt: null,
      transactions: [],
      createdAt: now,
      updatedAt: now,
    } as unknown as AccountEntity;
    const user = {
      id: 'user',
      email: 'test@example.com',
      username: 'testuser',
      name: 'Test User',
      phoneNumber: '+5511999999999',
      passwordHash: 'hashed',
      isActive: true,
      role: 'admin',
      baseCurrency: 'BRL',
      transactions: [],
      createdAt: now,
      updatedAt: now,
    } as unknown as UserEntity;
    accountsRepository.findOne.mockResolvedValue(account);
    usersRepository.findOne.mockResolvedValue(user);

    const dto: CreateTransactionDto = {
      occurredAt: new Date().toISOString(),
      accountId: 'acc',
      categoryId: 'cat',
      userId: 'user',
      amount: 10,
    };

    await expect(service.create(dto, ORG_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findAll returns query results', async () => {
    const { service, transactionsRepository } = setup();
    const rows = [{ id: 't1' }] as unknown as TransactionEntity[];
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    (transactionsRepository as unknown as { createQueryBuilder: jest.Mock }).createQueryBuilder =
      jest.fn().mockReturnValue(qb);
    const out = await service.findAll({});
    expect(out).toBe(rows);
    expect(qb.orderBy).toHaveBeenCalledWith('transaction.occurred_at', 'DESC');
  });

  it('findAll applies optional filters', async () => {
    const { service, transactionsRepository } = setup();
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    (transactionsRepository as unknown as { createQueryBuilder: jest.Mock }).createQueryBuilder =
      jest.fn().mockReturnValue(qb);
    await service.findAll({
      accountId: 'acc',
      categoryId: 'cat',
      userId: 'u',
      scopeUserId: 'scope',
      range: { start: new Date('2025-01-01'), end: new Date('2025-01-31') },
    });
    expect(qb.andWhere.mock.calls.length).toBeGreaterThan(2);
  });

  it('update persists and enqueues', async () => {
    const {
      service,
      transactionsRepository,
      categoriesRepository,
      auditRepository,
      projectionsQueue,
    } = setup();
    const now = new Date();
    const category = {
      id: 'cat',
      organizationId: ORG_ID,
      type: 'expense',
    } as unknown as CategoryEntity;
    const existing = {
      id: 'tid',
      organizationId: ORG_ID,
      source: 'web',
      lockedUntil: null,
      occurredAt: now,
      amount: '10.00',
      description: 'd',
      direction: 'expense',
      category,
      account: { id: 'acc' },
      user: { id: 'user' },
    } as unknown as TransactionEntity;
    transactionsRepository.findOne.mockResolvedValue(existing);
    categoriesRepository.findOne.mockResolvedValue({
      id: 'cat2',
      organizationId: ORG_ID,
      type: 'income',
    } as unknown as CategoryEntity);
    const saved = { ...existing, category: { id: 'cat2', type: 'income' }, direction: 'income' };
    transactionsRepository.save.mockResolvedValue(saved as TransactionEntity);
    auditRepository.save = jest.fn().mockResolvedValue({});
    auditRepository.create = jest.fn((x) => x);

    const dto: UpdateTransactionDto = { categoryId: 'cat2', amount: 20, description: 'x' };
    const res = await service.update('tid', dto, 'actor');
    expect(res.direction).toBe('income');
    expect(projectionsQueue.add).toHaveBeenCalled();
    expect(auditRepository.save).toHaveBeenCalled();
  });

  it('update learns description→category mapping when recategorized', async () => {
    const {
      service,
      transactionsRepository,
      categoriesRepository,
      auditRepository,
      categoryMappings,
    } = setup();
    const existing = {
      id: 'tid',
      organizationId: ORG_ID,
      source: 'web',
      lockedUntil: null,
      occurredAt: new Date(),
      amount: '10.00',
      description: 'IFOOD *PEDIDO',
      direction: 'expense',
      category: { id: 'cat', type: 'expense' },
      account: { id: 'acc' },
      user: { id: 'user' },
    } as unknown as TransactionEntity;
    transactionsRepository.findOne.mockResolvedValue(existing);
    categoriesRepository.findOne.mockResolvedValue({
      id: 'food',
      organizationId: ORG_ID,
      type: 'expense',
      isSystem: false,
    } as unknown as CategoryEntity);
    transactionsRepository.save.mockResolvedValue(existing);
    auditRepository.save = jest.fn().mockResolvedValue({});

    await service.update('tid', { categoryId: 'food' }, 'actor');
    expect(categoryMappings.upsert).toHaveBeenCalledWith(ORG_ID, 'IFOOD *PEDIDO', 'food');
  });

  it('update does NOT learn when recategorized to a system category', async () => {
    const {
      service,
      transactionsRepository,
      categoriesRepository,
      auditRepository,
      categoryMappings,
    } = setup();
    const existing = {
      id: 'tid',
      organizationId: ORG_ID,
      source: 'web',
      lockedUntil: null,
      occurredAt: new Date(),
      amount: '10.00',
      description: 'IFOOD *PEDIDO',
      direction: 'expense',
      category: { id: 'cat', type: 'expense' },
      account: { id: 'acc' },
      user: { id: 'user' },
    } as unknown as TransactionEntity;
    transactionsRepository.findOne.mockResolvedValue(existing);
    categoriesRepository.findOne.mockResolvedValue({
      id: 'sys-exp',
      organizationId: ORG_ID,
      type: 'expense',
      isSystem: true,
    } as unknown as CategoryEntity);
    transactionsRepository.save.mockResolvedValue(existing);
    auditRepository.save = jest.fn().mockResolvedValue({});

    await service.update('tid', { categoryId: 'sys-exp' }, 'actor');
    expect(categoryMappings.upsert).not.toHaveBeenCalled();
  });

  it('update rejects locked whatsapp transaction', async () => {
    const { service, transactionsRepository } = setup();
    const future = new Date(Date.now() + 60_000);
    transactionsRepository.findOne.mockResolvedValue({
      id: 'tid',
      organizationId: ORG_ID,
      source: 'whatsapp',
      lockedUntil: future,
      category: {},
      account: {},
      user: {},
    } as unknown as TransactionEntity);
    await expect(service.update('tid', { amount: 1 }, 'a')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('remove softRemoves and audits', async () => {
    const { service, transactionsRepository, auditRepository, projectionsQueue } = setup();
    transactionsRepository.findOne.mockResolvedValue({
      id: 'tid',
      organizationId: ORG_ID,
      source: 'web',
      lockedUntil: null,
    } as unknown as TransactionEntity);
    transactionsRepository.softRemove = jest.fn().mockResolvedValue(undefined);
    transactionsRepository.create = jest.fn(
      (p: Partial<TransactionEntity>) => p as TransactionEntity,
    );
    auditRepository.save = jest.fn().mockResolvedValue({});
    auditRepository.create = jest.fn((x) => x);
    await service.remove('tid', 'actor');
    expect(transactionsRepository.softRemove).toHaveBeenCalled();
    expect(projectionsQueue.add).toHaveBeenCalled();
  });

  it('remove rejects locked whatsapp', async () => {
    const { service, transactionsRepository } = setup();
    transactionsRepository.findOne.mockResolvedValue({
      id: 'tid',
      organizationId: ORG_ID,
      source: 'whatsapp',
      lockedUntil: new Date(Date.now() + 60_000),
    } as unknown as TransactionEntity);
    await expect(service.remove('tid', 'a')).rejects.toBeInstanceOf(ConflictException);
  });

  it('bulkCategorize categorizes owned, skips not-owned, reuses update()', async () => {
    const { service, transactionsRepository, categoriesRepository } = setup();
    categoriesRepository.findOne.mockResolvedValue({
      id: 'food',
      organizationId: ORG_ID,
      type: 'expense',
    } as unknown as CategoryEntity);
    (transactionsRepository as unknown as { find: jest.Mock }).find = jest
      .fn()
      .mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const updateSpy = jest
      .spyOn(service, 'update')
      .mockResolvedValue({} as unknown as TransactionEntity);

    const res = await service.bulkCategorize(ORG_ID, ['a', 'b', 'c'], 'food', 'actor');
    expect(res.updated).toBe(2);
    expect(res.skipped).toHaveLength(1);
    expect(res.skipped[0].id).toBe('c');
    expect(updateSpy).toHaveBeenCalledWith('a', { categoryId: 'food' }, 'actor', false);
  });

  it('bulkCategorize skips debt-linked (ConflictException from update)', async () => {
    const { service, transactionsRepository, categoriesRepository } = setup();
    categoriesRepository.findOne.mockResolvedValue({
      id: 'food',
      organizationId: ORG_ID,
      type: 'expense',
    } as unknown as CategoryEntity);
    (transactionsRepository as unknown as { find: jest.Mock }).find = jest
      .fn()
      .mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    jest.spyOn(service, 'update').mockImplementation(async (id: string) => {
      if (id === 'b') throw new ConflictException('dívida');
      return {} as unknown as TransactionEntity;
    });

    const res = await service.bulkCategorize(ORG_ID, ['a', 'b'], 'food', 'actor');
    expect(res.updated).toBe(1);
    expect(res.skipped).toEqual([{ id: 'b', reason: 'dívida' }]);
  });

  it('findUncategorizedGroups groups by normalized description + direction', async () => {
    const { service, transactionsRepository } = setup();
    const qb = {
      leftJoinAndSelect: () => qb,
      where: () => qb,
      andWhere: () => qb,
      orderBy: () => qb,
      getMany: jest.fn().mockResolvedValue([
        { id: '1', description: 'IFOOD *123', direction: 'expense', amount: '10.00' },
        { id: '2', description: 'IFOOD *999', direction: 'expense', amount: '20.00' },
        { id: '3', description: 'SALARIO', direction: 'income', amount: '100.00' },
      ]),
    };
    (transactionsRepository as unknown as { createQueryBuilder: jest.Mock }).createQueryBuilder =
      jest.fn().mockReturnValue(qb);

    const groups = await service.findUncategorizedGroups(ORG_ID);
    const ifood = groups.find((g) => g.descriptionKey.includes('ifood'));
    expect(ifood?.count).toBe(2);
    expect(ifood?.totalAmount).toBe('30.00');
    expect(groups.find((g) => g.direction === 'income')?.count).toBe(1);
  });

  it('create rejects a transfer-typed category (must use transfer endpoint)', async () => {
    const { service, categoriesRepository, accountsRepository, usersRepository } = setup();
    categoriesRepository.findOne.mockResolvedValue({
      id: 'sys-transfer',
      organizationId: ORG_ID,
      type: 'transfer',
    } as unknown as CategoryEntity);
    accountsRepository.findOne.mockResolvedValue({ id: 'acc', organizationId: ORG_ID } as unknown as AccountEntity);
    usersRepository.findOne.mockResolvedValue({ id: 'user' } as unknown as UserEntity);

    const dto: CreateTransactionDto = {
      occurredAt: new Date().toISOString(),
      accountId: 'acc',
      categoryId: 'sys-transfer',
      userId: 'user',
      amount: 10,
    };
    await expect(service.create(dto, ORG_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createTransfer (paired) creates an out leg and an in leg sharing a group', async () => {
    const { service, transactionsRepository, accountsRepository, usersRepository, categoriesService } =
      setup();
    usersRepository.findOne.mockResolvedValue({ id: 'user' } as unknown as UserEntity);
    accountsRepository.find.mockResolvedValue([
      { id: 'accA', organizationId: ORG_ID } as unknown as AccountEntity,
      { id: 'accB', organizationId: ORG_ID } as unknown as AccountEntity,
    ]);
    transactionsRepository.create.mockImplementation((p) => p as TransactionEntity);
    transactionsRepository.save.mockImplementation(async (legs) => legs as TransactionEntity[]);

    const legs = await service.createTransfer(
      { occurredAt: new Date().toISOString(), amount: 250, userId: 'user', fromAccountId: 'accA', toAccountId: 'accB' },
      ORG_ID,
    );

    expect(categoriesService.ensureSystemCategories).toHaveBeenCalledWith(ORG_ID);
    expect(legs).toHaveLength(2);
    const out = legs.find((l) => l.transferLeg === 'out')!;
    const inLeg = legs.find((l) => l.transferLeg === 'in')!;
    expect(out.account.id).toBe('accA');
    expect(inLeg.account.id).toBe('accB');
    expect(out.direction).toBe('transfer');
    expect(inLeg.direction).toBe('transfer');
    expect(out.amount).toBe('250.00');
    // Mesma transferência → mesmo group id nas duas pernas.
    expect(out.transferGroupId).toBe(inLeg.transferGroupId);
    expect(out.transferGroupId).toBeTruthy();
    expect(out.category.id).toBe('sys-transfer');
  });

  it('createTransfer (single leg) creates one leg with the given direction of flow', async () => {
    const { service, transactionsRepository, accountsRepository, usersRepository } = setup();
    usersRepository.findOne.mockResolvedValue({ id: 'user' } as unknown as UserEntity);
    accountsRepository.find.mockResolvedValue([
      { id: 'acc', organizationId: ORG_ID } as unknown as AccountEntity,
    ]);
    transactionsRepository.create.mockImplementation((p) => p as TransactionEntity);
    transactionsRepository.save.mockImplementation(async (legs) => legs as TransactionEntity[]);

    const legs = await service.createTransfer(
      { occurredAt: new Date().toISOString(), amount: 11343.47, userId: 'user', accountId: 'acc', leg: 'in' },
      ORG_ID,
    );
    expect(legs).toHaveLength(1);
    expect(legs[0].transferLeg).toBe('in');
    expect(legs[0].amount).toBe('11343.47');
    expect(legs[0].transferGroupId).toBeTruthy();
  });

  it('createTransfer rejects ambiguous/empty mode', async () => {
    const { service, usersRepository } = setup();
    usersRepository.findOne.mockResolvedValue({ id: 'user' } as unknown as UserEntity);
    // Nenhum modo informado.
    await expect(
      service.createTransfer({ occurredAt: new Date().toISOString(), amount: 10, userId: 'user' }, ORG_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
    // Ambos os modos informados.
    await expect(
      service.createTransfer(
        {
          occurredAt: new Date().toISOString(),
          amount: 10,
          userId: 'user',
          fromAccountId: 'a',
          toAccountId: 'b',
          accountId: 'c',
          leg: 'out',
        },
        ORG_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createTransfer rejects same source and destination account', async () => {
    const { service, usersRepository } = setup();
    usersRepository.findOne.mockResolvedValue({ id: 'user' } as unknown as UserEntity);
    await expect(
      service.createTransfer(
        { occurredAt: new Date().toISOString(), amount: 10, userId: 'user', fromAccountId: 'x', toAccountId: 'x' },
        ORG_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('remove deletes BOTH legs of a transfer group', async () => {
    const { service, transactionsRepository, auditRepository, projectionsQueue } = setup();
    const leg = {
      id: 'legA',
      organizationId: ORG_ID,
      source: 'web',
      lockedUntil: null,
      direction: 'transfer',
      transferGroupId: 'grp-1',
    } as unknown as TransactionEntity;
    transactionsRepository.findOne.mockResolvedValue(leg);
    transactionsRepository.find.mockResolvedValue([
      leg,
      { id: 'legB', organizationId: ORG_ID, direction: 'transfer', transferGroupId: 'grp-1' } as unknown as TransactionEntity,
    ]);
    transactionsRepository.softRemove = jest.fn().mockResolvedValue(undefined);
    transactionsRepository.create = jest.fn((p: Partial<TransactionEntity>) => p as TransactionEntity);
    auditRepository.save = jest.fn().mockResolvedValue({});
    auditRepository.create = jest.fn((x) => x);

    await service.remove('legA', 'actor');

    expect(transactionsRepository.find).toHaveBeenCalledWith({ where: { transferGroupId: 'grp-1' } });
    const removed = transactionsRepository.softRemove.mock.calls[0][0] as TransactionEntity[];
    expect(removed).toHaveLength(2);
    expect(projectionsQueue.add).toHaveBeenCalledTimes(2);
  });

  it('update rejects editing a transfer leg', async () => {
    const { service, transactionsRepository } = setup();
    transactionsRepository.findOne.mockResolvedValue({
      id: 'legA',
      organizationId: ORG_ID,
      source: 'web',
      lockedUntil: null,
      direction: 'transfer',
      transferGroupId: 'grp-1',
      category: {},
      account: {},
      user: {},
    } as unknown as TransactionEntity);
    await expect(service.update('legA', { amount: 5 }, 'actor')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
