import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { format } from 'date-fns';
import type { DateRange } from '../../common/pipes/date-range.pipe.js';
import {
  resolvePeriods,
  resolveWindow,
  resolveEvolutionMonths,
  type DateWindow,
} from './dashboard-window.util.js';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { ProjectionEntity } from '../../database/entities/projection.entity.js';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { ProjectionsService } from '../projections/projections.service';
import { BudgetsService } from '../budgets/budgets.service';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';

export type DashboardScope = string; // 'all' ou ID do utilizador

export interface DashboardSummary {
  period: string;
  scope: DashboardScope;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  topCategories: Array<{
    categoryId: string;
    name: string;
    total: number;
    limit?: number;
    percentUsed?: number;
  }>;
  monthlyBudgetLimit?: number | null;
  monthlyBudgetUsed?: number;
}

export interface CategoryReportItem {
  categoryId: string;
  name: string;
  type: 'income' | 'expense';
  totalIncome: number;
  totalExpense: number;
}

export interface CategoriesReportResponse {
  period: string;
  scope: DashboardScope;
  items: CategoryReportItem[];
}

export interface EvolutionReportItem {
  period: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface EvolutionReportResponse {
  scope: DashboardScope;
  items: EvolutionReportItem[];
}

/** Filtros opcionais comuns a todos os relatórios do dashboard. */
export interface DashboardFilters {
  /** Restringe a uma conta específica (omitido = todas as contas do âmbito). */
  accountId?: string;
  /** Intervalo livre por dia. Quando preenchido, sobrepõe-se ao `period` mensal. */
  range?: DateRange;
}

export interface TopTransactionItem {
  id: string;
  description: string | null;
  amount: number;
  direction: 'income' | 'expense';
  occurredAt: string;
  categoryName: string | null;
  accountName: string | null;
}

export interface TopTransactionsResponse {
  scope: DashboardScope;
  items: TopTransactionItem[];
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepository: Repository<TransactionEntity>,
    @InjectRepository(ProjectionEntity)
    private readonly projectionsRepository: Repository<ProjectionEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoriesRepository: Repository<CategoryEntity>,
    private readonly projectionsService: ProjectionsService,
    private readonly budgetsService: BudgetsService,
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  private async assertValidScope(scope: DashboardScope, organizationId: string): Promise<void> {
    if (scope === 'all') return;
    const user = await this.usersService.findById(scope);
    if (!user?.isActive) {
      throw new BadRequestException('Utilizador inválido ou inativo para o âmbito solicitado');
    }
    // Tenant isolation: the requested userId must belong to the active organization, so a caller
    // cannot read another org's user by passing their id.
    const isMember = await this.organizationsService.isActiveMember(scope, organizationId);
    if (!isMember) {
      throw new BadRequestException('Utilizador não pertence à organização activa');
    }
  }

  private applyScopeFilters(
    qb: ReturnType<Repository<TransactionEntity>['createQueryBuilder']>,
    scope: DashboardScope,
    organizationId: string,
    filters?: DashboardFilters,
    categoryAlias = 'category',
    transactionAlias = 'transaction',
  ): void {
    // Tenant isolation: every dashboard query is bounded to the active organization.
    qb.andWhere(`${transactionAlias}.organization_id = :orgId`, { orgId: organizationId });

    // Filtro opcional por conta (aplica-se em qualquer âmbito).
    if (filters?.accountId) {
      qb.andWhere(`${transactionAlias}.account = :accountId`, { accountId: filters.accountId });
    }

    if (scope === 'all') {
      qb.andWhere(`${categoryAlias}.ownerUserId IS NULL`);
      return;
    }

    // Filtro por propriedade da categoria (global ou do utilizador)
    qb.andWhere(
      new Brackets((sub) => {
        sub
          .where(`${categoryAlias}.ownerUserId IS NULL`)
          .orWhere(`${categoryAlias}.ownerUserId = :uid`, { uid: scope });
      }),
    );

    // Filtro por dono da transação (correção de isolamento)
    qb.andWhere(`${transactionAlias}.user = :uid`, { uid: scope });
  }

  /** Aplica o filtro de janela temporal (OR entre os intervalos) a um query builder. */
  private applyDateWindow(
    qb: ReturnType<Repository<TransactionEntity>['createQueryBuilder']>,
    ranges: DateWindow[],
    transactionAlias = 'transaction',
  ): void {
    qb.andWhere(
      new Brackets((sqb) => {
        ranges.forEach((r, i) => {
          sqb.orWhere(`${transactionAlias}.occurredAt BETWEEN :wstart${i} AND :wend${i}`, {
            [`wstart${i}`]: r.start,
            [`wend${i}`]: r.end,
          });
        });
      }),
    );
  }

  private applyUserCategoryFilterOnCategoryQb(
    qb: ReturnType<Repository<CategoryEntity>['createQueryBuilder']>,
    scope: DashboardScope,
    organizationId: string,
    alias = 'category',
  ): void {
    qb.andWhere(`${alias}.organization_id = :orgId`, { orgId: organizationId });
    if (scope === 'all') {
      qb.andWhere(`${alias}.ownerUserId IS NULL`);
      return;
    }
    qb.andWhere(
      new Brackets((sub) => {
        sub.where(`${alias}.ownerUserId IS NULL`).orWhere(`${alias}.ownerUserId = :uid`, {
          uid: scope,
        });
      }),
    );
  }

  async getSummary(
    scope: DashboardScope,
    period: string,
    organizationId: string,
    filters?: DashboardFilters,
  ): Promise<DashboardSummary> {
    await this.assertValidScope(scope, organizationId);
    const ranges = resolveWindow(period, filters?.range);

    const qb = this.transactionsRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.category', 'category')
      .select('transaction.direction', 'direction')
      .addSelect('SUM(CAST(transaction.amount AS numeric))', 'total')
      .where('transaction.deletedAt IS NULL');
    this.applyDateWindow(qb, ranges);
    this.applyScopeFilters(qb, scope, organizationId, filters);

    const results = await qb
      .groupBy('transaction.direction')
      .getRawMany<{ direction: string; total: string }>();

    const totals = results.reduce(
      (acc, row) => {
        const total = Number(row.total ?? 0);
        if (row.direction === 'income') acc.income += total;
        if (row.direction === 'expense') acc.expense += total;
        return acc;
      },
      { income: 0, expense: 0 },
    );

    const topQb = this.transactionsRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.category', 'category')
      .select('category.id', 'categoryId')
      .addSelect('category.name', 'name')
      .addSelect('SUM(CAST(transaction.amount AS numeric))', 'total')
      .where('transaction.deletedAt IS NULL')
      .andWhere('transaction.direction = :direction', { direction: 'expense' });
    this.applyDateWindow(topQb, ranges);
    this.applyScopeFilters(topQb, scope, organizationId, filters);

    const topCategories = await topQb
      .groupBy('category.id')
      .addGroupBy('category.name')
      .orderBy('total', 'DESC')
      .limit(5)
      .getRawMany<{ categoryId: string; name: string; total: string }>();

    const budgets = await this.budgetsService.getBudgetsForSummary(scope, period, organizationId);
    const topCategoriesWithBudget = topCategories.map((item) => {
      const total = Number(Number(item.total).toFixed(2));
      const limit = budgets.categoryLimits[item.categoryId];
      const percentUsed =
        limit != null && limit > 0 ? Math.min(100, Math.round((total / limit) * 100)) : undefined;
      return {
        categoryId: item.categoryId,
        name: item.name,
        total,
        ...(limit != null && { limit }),
        ...(percentUsed != null && { percentUsed }),
      };
    });

    return {
      period,
      scope,
      totalIncome: Number(totals.income.toFixed(2)),
      totalExpense: Number(totals.expense.toFixed(2)),
      balance: Number((totals.income - totals.expense).toFixed(2)),
      topCategories: topCategoriesWithBudget,
      monthlyBudgetLimit: budgets.monthlyLimit ?? null,
      monthlyBudgetUsed: Number(totals.expense.toFixed(2)),
    };
  }

  async getCategoriesReport(
    scope: DashboardScope,
    period: string,
    organizationId: string,
    filters?: DashboardFilters,
  ): Promise<CategoriesReportResponse> {
    await this.assertValidScope(scope, organizationId);
    const ranges = resolveWindow(period, filters?.range);

    const categoriesQb = this.categoriesRepository
      .createQueryBuilder('category')
      .select('category.id', 'id')
      .addSelect('category.name', 'name')
      .addSelect('category.type', 'type')
      .where('category.isActive = :active', { active: true });
    this.applyUserCategoryFilterOnCategoryQb(categoriesQb, scope, organizationId);
    categoriesQb.orderBy('category.sortOrder', 'ASC').addOrderBy('category.name', 'ASC');

    const categories = await categoriesQb.getRawMany<{ id: string; name: string; type: string }>();

    const totalsQb = this.transactionsRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.category', 'category')
      .select('category.id', 'categoryId')
      .addSelect('transaction.direction', 'direction')
      .addSelect('SUM(CAST(transaction.amount AS numeric))', 'total')
      .where('transaction.deletedAt IS NULL');
    this.applyDateWindow(totalsQb, ranges);
    this.applyScopeFilters(totalsQb, scope, organizationId, filters);

    const totalsRows = await totalsQb
      .groupBy('category.id')
      .addGroupBy('transaction.direction')
      .getRawMany<{ categoryId: string; direction: string; total: string }>();

    const totalsByCategory = new Map<string, { income: number; expense: number }>();
    for (const row of totalsRows) {
      if (!row.categoryId) continue;
      let entry = totalsByCategory.get(row.categoryId);
      if (!entry) {
        entry = { income: 0, expense: 0 };
        totalsByCategory.set(row.categoryId, entry);
      }
      const val = Number(row.total ?? 0);
      if (row.direction === 'income') entry.income += val;
      if (row.direction === 'expense') entry.expense += val;
    }

    const items: CategoryReportItem[] = categories.map((cat) => {
      const t = totalsByCategory.get(cat.id) ?? { income: 0, expense: 0 };
      return {
        categoryId: cat.id,
        name: cat.name,
        type: cat.type as 'income' | 'expense',
        totalIncome: Number(t.income.toFixed(2)),
        totalExpense: Number(t.expense.toFixed(2)),
      };
    });

    return { period, scope, items };
  }

  async getEvolutionReport(
    scope: DashboardScope,
    months: number,
    organizationId: string,
    filters?: DashboardFilters,
  ): Promise<EvolutionReportResponse> {
    await this.assertValidScope(scope, organizationId);
    const items: EvolutionReportItem[] = [];
    // Timeline mensal: no modo intervalo derivamos os meses que cobrem [start,end];
    // caso contrário usamos os últimos N meses a contar de hoje.
    const monthAnchors = resolveEvolutionMonths(months, filters?.range);
    for (const anchor of monthAnchors) {
      const periodStr = format(anchor, 'yyyy-MM');
      const ranges = resolvePeriods(periodStr);
      const qb = this.transactionsRepository
        .createQueryBuilder('transaction')
        .leftJoin('transaction.category', 'category')
        .select('transaction.direction', 'direction')
        .addSelect('SUM(CAST(transaction.amount AS numeric))', 'total')
        .where('transaction.deletedAt IS NULL');
      this.applyDateWindow(qb, ranges);
      this.applyScopeFilters(qb, scope, organizationId, filters);
      const results = await qb
        .groupBy('transaction.direction')
        .getRawMany<{ direction: string; total: string }>();
      const totals = results.reduce(
        (acc, row) => {
          const total = Number(row.total ?? 0);
          if (row.direction === 'income') acc.income += total;
          if (row.direction === 'expense') acc.expense += total;
          return acc;
        },
        { income: 0, expense: 0 },
      );
      items.push({
        period: periodStr,
        totalIncome: Number(totals.income.toFixed(2)),
        totalExpense: Number(totals.expense.toFixed(2)),
        balance: Number((totals.income - totals.expense).toFixed(2)),
      });
    }
    return { scope, items };
  }

  /** Top N lançamentos (receita/despesa) por valor absoluto na janela; exclui transferências. */
  async getTopTransactions(
    scope: DashboardScope,
    period: string,
    organizationId: string,
    limit: number,
    filters?: DashboardFilters,
  ): Promise<TopTransactionsResponse> {
    await this.assertValidScope(scope, organizationId);
    const ranges = resolveWindow(period, filters?.range);

    const qb = this.transactionsRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.category', 'category')
      .leftJoin('transaction.account', 'account')
      .select('transaction.id', 'id')
      .addSelect('transaction.description', 'description')
      .addSelect('transaction.amount', 'amount')
      .addSelect('transaction.direction', 'direction')
      .addSelect('transaction.occurredAt', 'occurredAt')
      .addSelect('category.name', 'categoryName')
      .addSelect('account.name', 'accountName')
      .where('transaction.deletedAt IS NULL')
      // Transferências/investimentos são neutros — fora do ranking de gastos/receitas.
      .andWhere('transaction.direction IN (:...directions)', { directions: ['income', 'expense'] });
    this.applyDateWindow(qb, ranges);
    this.applyScopeFilters(qb, scope, organizationId, filters);

    const rows = await qb
      .orderBy('CAST(transaction.amount AS numeric)', 'DESC')
      .limit(limit)
      .getRawMany<{
        id: string;
        description: string | null;
        amount: string;
        direction: 'income' | 'expense';
        occurredAt: Date;
        categoryName: string | null;
        accountName: string | null;
      }>();

    return {
      scope,
      items: rows.map((r) => ({
        id: r.id,
        description: r.description,
        amount: Number(Number(r.amount).toFixed(2)),
        direction: r.direction,
        occurredAt: new Date(r.occurredAt).toISOString(),
        categoryName: r.categoryName,
        accountName: r.accountName,
      })),
    };
  }

  getProjections(scope: DashboardScope, organizationId: string): Promise<ProjectionEntity | null> {
    return this.projectionsService.getLatest(scope, organizationId);
  }

  async requestRecalculation(scope: DashboardScope, trigger: string, organizationId: string) {
    // Validate the scope belongs to the active org before enqueuing a recalculation.
    await this.assertValidScope(scope, organizationId);
    return this.projectionsService.scheduleRecalculation(scope, trigger, organizationId);
  }

  async getExportCsv(
    scope: DashboardScope,
    period: string,
    includeCategorySummary: boolean,
    organizationId: string,
    filters?: DashboardFilters,
  ): Promise<string> {
    await this.assertValidScope(scope, organizationId);
    const ranges = resolveWindow(period, filters?.range);
    const qb = this.transactionsRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('transaction.account', 'account')
      .leftJoinAndSelect('transaction.user', 'user')
      .where('transaction.deletedAt IS NULL');
    this.applyDateWindow(qb, ranges);
    this.applyScopeFilters(qb, scope, organizationId, filters);
    qb.orderBy('transaction.occurredAt', 'ASC');
    const transactions = await qb.getMany();

    const escape = (v: string | number | null | undefined): string => {
      if (v == null) return '';
      const s = String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header = 'Data;Descrição;Valor;Direção;Categoria;Conta;Origem';
    const rows = transactions.map((t) =>
      [
        new Date(t.occurredAt).toISOString().slice(0, 10),
        t.description ?? '',
        t.amount,
        t.direction,
        t.category?.name ?? '',
        t.account?.name ?? '',
        t.source ?? 'web',
      ]
        .map(escape)
        .join(';'),
    );
    let csv = [header, ...rows].join('\r\n');

    if (includeCategorySummary) {
      const report = await this.getCategoriesReport(scope, period, organizationId, filters);
      csv += '\r\n\r\nResumo por categoria\r\n';
      csv += 'Categoria;Tipo;Receitas;Despesas\r\n';
      for (const item of report.items) {
        csv +=
          [item.name, item.type, item.totalIncome, item.totalExpense].map(escape).join(';') +
          '\r\n';
      }
    }

    return csv;
  }
}
