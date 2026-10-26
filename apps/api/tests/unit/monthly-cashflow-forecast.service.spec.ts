import type { Repository } from 'typeorm';
import { MonthlyCashflowForecastService } from '@app/modules/projections/monthly-cashflow-forecast.service';
import { TransactionEntity } from '@app/database/entities/transaction.entity';
import type { BudgetsService } from '@app/modules/budgets/budgets.service';

describe('MonthlyCashflowForecastService', () => {
  it('usa receita estimada e soma de categorias quando existem', async () => {
    const transactionsRepository = {
      createQueryBuilder: jest.fn(),
    } as unknown as Repository<TransactionEntity>;

    const budgetsService = {
      getMonthlyBudget: jest.fn().mockResolvedValue({
        id: '1',
        scopeUserId: null,
        period: '2026-08',
        amount: '3000.00',
        estimatedAverageIncome: '5000.00',
      }),
      sumCategoryBudgetAmounts: jest.fn().mockResolvedValue(2800),
    } as unknown as BudgetsService;

    const service = new MonthlyCashflowForecastService(transactionsRepository, budgetsService);

    const r = await service.projectMonth('all', '2026-08', new Date('2026-03-15'));

    expect(r.projectedIncome).toBe(5000);
    expect(r.projectedExpense).toBe(2800);
    expect(budgetsService.sumCategoryBudgetAmounts).toHaveBeenCalledWith('all', '2026-08');
  });

  it('para mês futuro sem orçamento usa média ponderada do histórico', async () => {
    const getRawMany = jest.fn().mockResolvedValue([
      { period: new Date(2026, 5, 1), direction: 'income', total: '2000' },
      { period: new Date(2026, 5, 1), direction: 'expense', total: '800' },
      { period: new Date(2026, 4, 1), direction: 'income', total: '2000' },
      { period: new Date(2026, 4, 1), direction: 'expense', total: '800' },
      { period: new Date(2026, 3, 1), direction: 'income', total: '2000' },
      { period: new Date(2026, 3, 1), direction: 'expense', total: '800' },
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
        getRawMany,
      }),
    } as unknown as Repository<TransactionEntity>;

    const budgetsService = {
      getMonthlyBudget: jest.fn().mockResolvedValue(null),
      sumCategoryBudgetAmounts: jest.fn().mockResolvedValue(0),
    } as unknown as BudgetsService;

    const service = new MonthlyCashflowForecastService(transactionsRepository, budgetsService);

    const r = await service.projectMonth('all', '2026-07', new Date('2026-03-15'));

    expect(r.projectedIncome).toBe(2000);
    expect(r.projectedExpense).toBe(800);
  });
});
