import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { BudgetsService } from '@app/modules/budgets/budgets.service';
import type { CategoryBudgetEntity } from '@app/database/entities/category-budget.entity';
import type { MonthlyBudgetEntity } from '@app/database/entities/monthly-budget.entity';
import type { TransactionEntity } from '@app/database/entities/transaction.entity';
import type { UsersService } from '@app/modules/users/users.service';

describe('BudgetsService', () => {
  const setup = () => {
    const categoryBudgetsRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((x: object) => x),
      save: jest.fn(),
      delete: jest.fn(),
    } as unknown as Repository<CategoryBudgetEntity>;

    const monthlyBudgetsRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((x: object) => x),
      save: jest.fn(),
    } as unknown as Repository<MonthlyBudgetEntity>;

    const transactionsRepository = {
      createQueryBuilder: jest.fn(),
    } as unknown as Repository<TransactionEntity>;

    const usersService = {
      findById: jest.fn().mockResolvedValue({ id: 'u1', isActive: true }),
    } as unknown as UsersService;

    const service = new BudgetsService(
      categoryBudgetsRepository,
      monthlyBudgetsRepository,
      transactionsRepository,
      usersService,
    );

    return {
      service,
      categoryBudgetsRepository,
      monthlyBudgetsRepository,
      usersService,
    };
  };

  it('getCategoryBudgets rejects invalid scope user', async () => {
    const { service, usersService } = setup();
    usersService.findById = jest.fn().mockResolvedValue(null);
    await expect(service.getCategoryBudgets('bad', '2025-01')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('sumCategoryBudgetAmounts sums category rows', async () => {
    const { service, categoryBudgetsRepository } = setup();
    (categoryBudgetsRepository.find as jest.Mock).mockResolvedValue([
      { amount: '100.50' },
      { amount: '200.00' },
    ]);
    const sum = await service.sumCategoryBudgetAmounts('all', '2025-01');
    expect(sum).toBe(300.5);
  });

  it('getBudgetsForSummary aggregates limits', async () => {
    const { service, categoryBudgetsRepository, monthlyBudgetsRepository } = setup();
    (categoryBudgetsRepository.find as jest.Mock).mockResolvedValue([
      { categoryId: 'c1', amount: '100.00' },
      { categoryId: 'c1', amount: '50.00' },
    ]);
    (monthlyBudgetsRepository.find as jest.Mock).mockResolvedValue([{ amount: '500.00' }]);
    const s = await service.getBudgetsForSummary('all', '2025-01');
    expect(s.categoryLimits.c1).toBe(150);
    expect(s.monthlyLimit).toBe(500);
  });

  it('deleteCategoryBudget throws when nothing removed', async () => {
    const { service, categoryBudgetsRepository } = setup();
    (categoryBudgetsRepository.delete as jest.Mock).mockResolvedValue({ affected: 0 });
    await expect(service.deleteCategoryBudget('c', 'all', '2025-01')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
