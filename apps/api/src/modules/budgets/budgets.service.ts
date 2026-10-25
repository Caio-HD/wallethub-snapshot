import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Equal, In } from 'typeorm';
import { CategoryBudgetEntity } from '../../database/entities/category-budget.entity.js';
import { MonthlyBudgetEntity } from '../../database/entities/monthly-budget.entity.js';
import { UsersService } from '../users/users.service';

export type BudgetScope = string; // 'all' ou ID do utilizador

export interface CategoryBudgetDto {
  id: string;
  categoryId: string;
  scopeUserId: string | null;
  period: string;
  amount: string;
  averageSpent?: number;
}

export interface MonthlyBudgetDto {
  id: string;
  scopeUserId: string | null;
  period: string;
  amount: string;
  estimatedAverageIncome: string | null;
}

export interface BudgetsForSummary {
  categoryLimits: Record<string, number>;
  monthlyLimit: number | null;
}

import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(CategoryBudgetEntity)
    private readonly categoryBudgetsRepository: Repository<CategoryBudgetEntity>,
    @InjectRepository(MonthlyBudgetEntity)
    private readonly monthlyBudgetsRepository: Repository<MonthlyBudgetEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepository: Repository<TransactionEntity>,
    private readonly usersService: UsersService,
  ) {}

  private scopeWhere(scope: BudgetScope) {
    return scope === 'all' ? IsNull() : Equal(scope);
  }

  private async assertScope(scope: BudgetScope): Promise<void> {
    if (scope === 'all') return;
    const u = await this.usersService.findById(scope);
    if (!u?.isActive)
      throw new BadRequestException('Utilizador inválido para o âmbito do orçamento');
  }

  async getCategoryBudgets(scope: BudgetScope, period: string): Promise<CategoryBudgetDto[]> {
    await this.assertScope(scope);
    const rows = await this.categoryBudgetsRepository.find({
      where: { scopeUserId: this.scopeWhere(scope), period },
      order: { createdAt: 'ASC' },
    });

    const dtos: CategoryBudgetDto[] = [];
    for (const r of rows) {
      const averageSpent = await this.getAverageSpent(r.categoryId, scope, period);
      dtos.push({
        id: r.id,
        categoryId: r.categoryId,
        scopeUserId: r.scopeUserId,
        period: r.period,
        amount: r.amount,
        averageSpent,
      });
    }
    return dtos;
  }

  async setCategoryBudget(
    categoryId: string,
    scope: BudgetScope,
    period: string,
    amount: number,
    organizationId: string,
  ): Promise<CategoryBudgetDto> {
    await this.assertScope(scope);
    const sw = this.scopeWhere(scope);
    let row = await this.categoryBudgetsRepository.findOne({
      where: { categoryId, scopeUserId: sw, period, organizationId },
    });
    if (row) {
      row.amount = amount.toFixed(2);
      await this.categoryBudgetsRepository.save(row);
    } else {
      row = this.categoryBudgetsRepository.create({
        organizationId,
        categoryId,
        scopeUserId: scope === 'all' ? null : scope,
        period,
        amount: amount.toFixed(2),
      });
      await this.categoryBudgetsRepository.save(row);
    }
    return {
      id: row.id,
      categoryId: row.categoryId,
      scopeUserId: row.scopeUserId,
      period: row.period,
      amount: row.amount,
      averageSpent: await this.getAverageSpent(categoryId, scope, period),
    };
  }

  async deleteCategoryBudget(
    categoryId: string,
    scope: BudgetScope,
    period: string,
  ): Promise<void> {
    await this.assertScope(scope);
    const result = await this.categoryBudgetsRepository.delete({
      categoryId,
      scopeUserId: this.scopeWhere(scope),
      period,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Orçamento da categoria não encontrado');
    }
  }

  async getMonthlyBudget(scope: BudgetScope, period: string): Promise<MonthlyBudgetDto | null> {
    await this.assertScope(scope);
    const row = await this.monthlyBudgetsRepository.findOne({
      where: { scopeUserId: this.scopeWhere(scope), period },
    });
    if (!row) return null;
    return {
      id: row.id,
      scopeUserId: row.scopeUserId,
      period: row.period,
      amount: row.amount,
      estimatedAverageIncome: row.estimatedAverageIncome,
    };
  }

  async setMonthlyBudget(
    scope: BudgetScope,
    period: string,
    amount: number,
    organizationId: string,
    estimatedAverageIncome?: number,
  ): Promise<MonthlyBudgetDto> {
    await this.assertScope(scope);
    const sw = this.scopeWhere(scope);
    let row = await this.monthlyBudgetsRepository.findOne({
      where: { scopeUserId: sw, period, organizationId },
    });
    if (row) {
      row.amount = amount.toFixed(2);
      if (estimatedAverageIncome !== undefined) {
        row.estimatedAverageIncome = estimatedAverageIncome.toFixed(2);
      }
      await this.monthlyBudgetsRepository.save(row);
    } else {
      row = this.monthlyBudgetsRepository.create({
        organizationId,
        scopeUserId: scope === 'all' ? null : scope,
        period,
        amount: amount.toFixed(2),
        estimatedAverageIncome: estimatedAverageIncome?.toFixed(2),
      });
      await this.monthlyBudgetsRepository.save(row);
    }
    return {
      id: row.id,
      scopeUserId: row.scopeUserId,
      period: row.period,
      amount: row.amount,
      estimatedAverageIncome: row.estimatedAverageIncome,
    };
  }

  /** Soma dos orçamentos por categoria num período (ex.: projeção de despesas). */
  async sumCategoryBudgetAmounts(scope: BudgetScope, period: string): Promise<number> {
    await this.assertScope(scope);
    const rows = await this.categoryBudgetsRepository.find({
      where: { scopeUserId: this.scopeWhere(scope), period },
    });
    return rows.reduce((s, r) => s + Number(r.amount), 0);
  }

  async getBudgetsForSummary(
    scope: BudgetScope,
    period: string,
    organizationId?: string,
  ): Promise<BudgetsForSummary> {
    await this.assertScope(scope);
    const periods = period.split(',').map((p) => p.trim());
    const condition = periods.length === 1 ? periods[0] : In(periods);
    // Tenant isolation: when an organization is provided (dashboard), bound budgets to it.
    const orgWhere = organizationId ? { organizationId } : {};

    const categoryRows = await this.categoryBudgetsRepository.find({
      where: { scopeUserId: this.scopeWhere(scope), period: condition, ...orgWhere },
    });
    const categoryLimits: Record<string, number> = {};
    for (const r of categoryRows) {
      if (!categoryLimits[r.categoryId]) categoryLimits[r.categoryId] = 0;
      categoryLimits[r.categoryId] += Number(r.amount);
    }
    const monthlyRows = await this.monthlyBudgetsRepository.find({
      where: { scopeUserId: this.scopeWhere(scope), period: condition, ...orgWhere },
    });
    const monthlyLimit =
      monthlyRows.length > 0 ? monthlyRows.reduce((a, b) => a + Number(b.amount), 0) : null;
    return {
      categoryLimits,
      monthlyLimit,
    };
  }

  private async getAverageSpent(
    categoryId: string,
    scope: BudgetScope,
    currentPeriod: string,
  ): Promise<number> {
    // Se o período for 'default', usamos os últimos 3 meses reais a partir de agora
    // Se for um mês específico, usamos os 3 meses anteriores a esse mês
    let referenceDate = new Date();
    if (currentPeriod !== 'default') {
      const [year, month] = currentPeriod.split('-').map(Number);
      referenceDate = new Date(year, month - 1, 1);
    }

    const start = startOfMonth(subMonths(referenceDate, 3));
    const end = endOfMonth(subMonths(referenceDate, 1));

    const qb = this.transactionsRepository
      .createQueryBuilder('t')
      .select('SUM(CAST(t.amount AS numeric))', 'total')
      .where('t.category_id = :categoryId', { categoryId })
      .andWhere('t.occurred_at >= :start', { start })
      .andWhere('t.occurred_at <= :end', { end })
      .andWhere('t.direction = :direction', { direction: 'expense' });

    if (scope !== 'all') {
      qb.andWhere('t.user_id = :userId', { userId: scope });
    }

    const result = await qb.getRawOne<{ total: string | null }>();
    const total = result?.total;
    return total ? Number(total) / 3 : 0;
  }
}
