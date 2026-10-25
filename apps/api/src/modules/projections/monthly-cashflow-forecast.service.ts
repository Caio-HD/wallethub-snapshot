import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { endOfMonth, format, parse, startOfMonth, subMonths } from 'date-fns';
import { TransactionEntity } from '../../database/entities/transaction.entity';
import { BudgetsService, type BudgetScope } from '../budgets/budgets.service';
import { applyProjectionWeights } from './projection-weights';

/**
 * Projeção mês a mês: orçamento (receita estimada + limites) com fallback em histórico ponderado.
 * Usado pela série do dashboard (meses futuros) e pelo job de projeção (mês corrente).
 */
@Injectable()
export class MonthlyCashflowForecastService {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepository: Repository<TransactionEntity>,
    private readonly budgetsService: BudgetsService,
  ) {}

  private applyTransactionScope(
    qb: ReturnType<Repository<TransactionEntity>['createQueryBuilder']>,
    scope: BudgetScope,
  ): void {
    if (scope === 'all') {
      qb.andWhere('category.owner_user_id IS NULL');
      return;
    }
    qb.andWhere(
      new Brackets((sub) => {
        sub
          .where('category.owner_user_id IS NULL')
          .orWhere('category.owner_user_id = :uid', { uid: scope });
      }),
    );
    qb.andWhere('transaction.user_id = :uid', { uid: scope });
  }

  /**
   * Totais por mês calendário no intervalo [start, end] (inclusive).
   */
  async getMonthlyTotals(
    scope: BudgetScope,
    start: Date,
    end: Date,
  ): Promise<Map<string, { income: number; expense: number }>> {
    const qb = this.transactionsRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.category', 'category')
      .select("DATE_TRUNC('month', transaction.occurred_at)", 'period')
      .addSelect('transaction.direction', 'direction')
      .addSelect('SUM(CAST(transaction.amount AS numeric))', 'total')
      .where('transaction.deleted_at IS NULL')
      .andWhere('transaction.occurred_at BETWEEN :start AND :end', { start, end });
    this.applyTransactionScope(qb, scope);

    const rows = await qb
      .groupBy("DATE_TRUNC('month', transaction.occurred_at)")
      .addGroupBy('transaction.direction')
      .getRawMany<{ period: Date; direction: 'income' | 'expense'; total: string }>();

    const totals = new Map<string, { income: number; expense: number }>();

    for (const row of rows) {
      const key = format(new Date(row.period), 'yyyy-MM');
      const current = totals.get(key) ?? { income: 0, expense: 0 };
      const value = Number(row.total ?? 0);
      if (row.direction === 'income') {
        current.income += value;
      }
      if (row.direction === 'expense') {
        current.expense += value;
      }
      totals.set(key, current);
    }

    return totals;
  }

  /** Chaves yyyy-MM para média ponderada: mês corrente alinha com [0,1,2] a partir de `today`; futuros usam os 3 meses antes do período. */
  getThreeMonthKeysForWeightedFallback(periodYyyyMm: string, today: Date): string[] {
    const periodStart = startOfMonth(parse(`${periodYyyyMm}-01`, 'yyyy-MM-dd', new Date()));
    const startCurrent = startOfMonth(today);

    if (periodStart.getTime() === startCurrent.getTime()) {
      return [0, 1, 2].map((offset) => format(startOfMonth(subMonths(today, offset)), 'yyyy-MM'));
    }

    return [1, 2, 3].map((offset) =>
      format(startOfMonth(subMonths(periodStart, offset)), 'yyyy-MM'),
    );
  }

  async projectMonth(
    scope: BudgetScope,
    periodYyyyMm: string,
    today = new Date(),
  ): Promise<{
    projectedIncome: number;
    projectedExpense: number;
  }> {
    const monthlyRow = await this.budgetsService.getMonthlyBudget(scope, periodYyyyMm);
    const estimatedIncome =
      monthlyRow?.estimatedAverageIncome != null && monthlyRow.estimatedAverageIncome !== ''
        ? Number(monthlyRow.estimatedAverageIncome)
        : null;

    let projectedIncome: number;
    if (estimatedIncome != null && !Number.isNaN(estimatedIncome)) {
      projectedIncome = Number(estimatedIncome.toFixed(2));
    } else {
      const keys = this.getThreeMonthKeysForWeightedFallback(periodYyyyMm, today);
      const minD = startOfMonth(parse(`${keys[2]}-01`, 'yyyy-MM-dd', new Date()));
      const maxD = endOfMonth(parse(`${keys[0]}-01`, 'yyyy-MM-dd', new Date()));
      const map = await this.getMonthlyTotals(scope, minD, maxD);
      const incomes = keys.map((k) => map.get(k)?.income ?? 0);
      projectedIncome = applyProjectionWeights(incomes);
    }

    const categorySum = await this.budgetsService.sumCategoryBudgetAmounts(scope, periodYyyyMm);
    let projectedExpense: number;
    if (categorySum > 0) {
      projectedExpense = Number(categorySum.toFixed(2));
    } else if (monthlyRow != null && Number(monthlyRow.amount) > 0) {
      projectedExpense = Number(Number(monthlyRow.amount).toFixed(2));
    } else {
      const keys = this.getThreeMonthKeysForWeightedFallback(periodYyyyMm, today);
      const minD = startOfMonth(parse(`${keys[2]}-01`, 'yyyy-MM-dd', new Date()));
      const maxD = endOfMonth(parse(`${keys[0]}-01`, 'yyyy-MM-dd', new Date()));
      const map = await this.getMonthlyTotals(scope, minD, maxD);
      const expenses = keys.map((k) => map.get(k)?.expense ?? 0);
      projectedExpense = applyProjectionWeights(expenses);
    }

    return { projectedIncome, projectedExpense };
  }

  calculateTrend(incomes: number[], expenses: number[]): 'up' | 'flat' | 'down' {
    const currentNet = incomes[0] - expenses[0];
    const previousNet = incomes[1] - expenses[1];
    const delta = currentNet - previousNet;

    if (delta > 1) {
      return 'up';
    }
    if (delta < -1) {
      return 'down';
    }
    return 'flat';
  }
}
