import type { Repository } from 'typeorm';
import { DashboardService } from '@app/modules/dashboard/dashboard.service';
import { TransactionEntity } from '@app/database/entities/transaction.entity';
import { ProjectionEntity } from '@app/database/entities/projection.entity';
import { CategoryEntity } from '@app/database/entities/category.entity';
import { ProjectionsService } from '@app/modules/projections/projections.service';
import { BudgetsService } from '@app/modules/budgets/budgets.service';
import { UsersService } from '@app/modules/users/users.service';
import { OrganizationsService } from '@app/modules/organizations/organizations.service';

describe('DashboardService', () => {
  const ORG = 'org-1';
  const mkUsers = (active = true) =>
    ({
      findById: jest.fn().mockResolvedValue({ id: 'user-1', isActive: active }),
    }) as unknown as UsersService;
  const mkOrgs = (member = true) =>
    ({
      isActiveMember: jest.fn().mockResolvedValue(member),
    }) as unknown as OrganizationsService;

  describe('getCategoriesReport', () => {
    it('returns period, scope and items', async () => {
      const categoriesGetRawMany = jest.fn().mockResolvedValue([
        { id: 'cat-1', name: 'Food', type: 'expense' },
      ]);
      const categoriesRepository = {
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          addOrderBy: jest.fn().mockReturnThis(),
          getRawMany: categoriesGetRawMany,
        }),
      } as unknown as Repository<CategoryEntity>;

      const transactionsGetRawMany = jest.fn().mockResolvedValue([
        { categoryId: 'cat-1', direction: 'expense', total: '50.00' },
      ]);
      const transactionsRepository = {
        createQueryBuilder: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          addGroupBy: jest.fn().mockReturnThis(),
          getRawMany: transactionsGetRawMany,
        }),
      } as unknown as Repository<TransactionEntity>;

      const service = new DashboardService(
        transactionsRepository,
        {} as Repository<ProjectionEntity>,
        categoriesRepository,
        { getLatest: jest.fn() } as unknown as ProjectionsService,
        {
          getBudgetsForSummary: jest.fn().mockResolvedValue({
            categoryLimits: {},
            monthlyLimit: null,
          }),
        } as unknown as BudgetsService,
        mkUsers(),
        mkOrgs(),
      );

      const result = await service.getCategoriesReport('all', '2025-01', ORG);
      expect(result.period).toBe('2025-01');
      expect(result.scope).toBe('all');
      expect(result.items[0]).toMatchObject({
        categoryId: 'cat-1',
        totalExpense: 50,
      });
    });
  });

  describe('getSummary', () => {
    it('returns totals and budget fields', async () => {
      const transactionsGetRawMany = jest.fn().mockResolvedValue([
        { direction: 'income', total: '100.00' },
        { direction: 'expense', total: '40.00' },
      ]);
      let call = 0;
      const transactionsRepository = {
        createQueryBuilder: jest.fn().mockImplementation(() => {
          call += 1;
          const base = {
            leftJoin: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
          };
          if (call === 1) {
            return { ...base, getRawMany: transactionsGetRawMany };
          }
          return {
            ...base,
            addGroupBy: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
          };
        }),
      } as unknown as Repository<TransactionEntity>;

      const service = new DashboardService(
        transactionsRepository,
        {} as Repository<ProjectionEntity>,
        {} as Repository<CategoryEntity>,
        { getLatest: jest.fn() } as unknown as ProjectionsService,
        {
          getBudgetsForSummary: jest.fn().mockResolvedValue({
            categoryLimits: {},
            monthlyLimit: 500,
          }),
        } as unknown as BudgetsService,
        mkUsers(),
        mkOrgs(),
      );

      const result = await service.getSummary('all', '2025-01', ORG);
      expect(result.totalIncome).toBe(100);
      expect(result.totalExpense).toBe(40);
      expect(result.balance).toBe(60);
      expect(result.monthlyBudgetLimit).toBe(500);
      expect(result.monthlyBudgetUsed).toBe(40);
    });

    it('excludes transfer movements from income/expense totals', async () => {
      // O agrupamento por direção pode trazer uma linha 'transfer'; ela NÃO deve entrar nos totais.
      const transactionsGetRawMany = jest.fn().mockResolvedValue([
        { direction: 'income', total: '100.00' },
        { direction: 'expense', total: '40.00' },
        { direction: 'transfer', total: '5000.00' },
      ]);
      let call = 0;
      const transactionsRepository = {
        createQueryBuilder: jest.fn().mockImplementation(() => {
          call += 1;
          const base = {
            leftJoin: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
          };
          if (call === 1) {
            return { ...base, getRawMany: transactionsGetRawMany };
          }
          return {
            ...base,
            addGroupBy: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
          };
        }),
      } as unknown as Repository<TransactionEntity>;

      const service = new DashboardService(
        transactionsRepository,
        {} as Repository<ProjectionEntity>,
        {} as Repository<CategoryEntity>,
        { getLatest: jest.fn() } as unknown as ProjectionsService,
        {
          getBudgetsForSummary: jest.fn().mockResolvedValue({ categoryLimits: {}, monthlyLimit: null }),
        } as unknown as BudgetsService,
        mkUsers(),
        mkOrgs(),
      );

      const result = await service.getSummary('all', '2025-01', ORG);
      // 5000 de transferência ignorado: income/expense/balance inalterados.
      expect(result.totalIncome).toBe(100);
      expect(result.totalExpense).toBe(40);
      expect(result.balance).toBe(60);
    });
  });

  describe('getEvolutionReport', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns one item per month', async () => {
      const getRawMany = jest.fn().mockResolvedValue([
        { direction: 'income', total: '10' },
        { direction: 'expense', total: '3' },
      ]);
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany,
      };
      const transactionsRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      } as unknown as Repository<TransactionEntity>;

      const service = new DashboardService(
        transactionsRepository,
        {} as Repository<ProjectionEntity>,
        {} as Repository<CategoryEntity>,
        { getLatest: jest.fn() } as unknown as ProjectionsService,
        {} as unknown as BudgetsService,
        mkUsers(),
        mkOrgs(),
      );

      const result = await service.getEvolutionReport('all', 2, ORG);
      expect(result.items.length).toBe(2);
      expect(result.items[0]).toMatchObject({
        totalIncome: 10,
        totalExpense: 3,
        balance: 7,
      });
    });
  });

  describe('getExportCsv', () => {
    it('returns header and row', async () => {
      const tx = {
        occurredAt: new Date('2025-01-15T12:00:00.000Z'),
        description: 'x',
        amount: '1',
        direction: 'expense',
        category: { name: 'C' },
        account: { name: 'A' },
        source: 'web',
      } as unknown as TransactionEntity;
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([tx]),
      };
      const transactionsRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      } as unknown as Repository<TransactionEntity>;

      const service = new DashboardService(
        transactionsRepository,
        {} as Repository<ProjectionEntity>,
        {} as Repository<CategoryEntity>,
        { getLatest: jest.fn() } as unknown as ProjectionsService,
        {} as unknown as BudgetsService,
        mkUsers(),
        mkOrgs(),
      );

      const csv = await service.getExportCsv('all', '2025-01', false, ORG);
      expect(csv).toContain('Data;Descrição');
    });
  });
});
