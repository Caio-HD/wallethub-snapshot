import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Equal, Brackets } from 'typeorm';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { ProjectionEntity } from '../../database/entities/projection.entity.js';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { OrganizationEntity } from '../../database/entities/organization.entity.js';
import { OrganizationMembershipEntity } from '../../database/entities/organization-membership.entity.js';
import { QUEUE_ALERTS, QUEUE_PROJECTIONS } from '../../queues';

const PROJECTION_WEIGHTS = [0.5, 0.3, 0.2];

type ScopeKey = string; // 'all' ou ID do utilizador

interface RecalculateJobPayload {
  transactionId?: string;
  scope?: ScopeKey;
  organizationId?: string;
  trigger?: string;
}

@Injectable()
@Processor(QUEUE_PROJECTIONS)
export class ProjectionsProcessor extends WorkerHost {
  private readonly logger = new Logger(ProjectionsProcessor.name);

  constructor(
    @InjectRepository(ProjectionEntity)
    private readonly projectionsRepository: Repository<ProjectionEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepository: Repository<TransactionEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizationsRepository: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationMembershipEntity)
    private readonly membershipsRepository: Repository<OrganizationMembershipEntity>,
    @InjectQueue(QUEUE_ALERTS) private readonly alertsQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<RecalculateJobPayload>): Promise<void> {
    if (
      job.name === 'recalculate-scope' &&
      job.data.scope != null &&
      job.data.organizationId != null
    ) {
      await this.recalculateScope(job.data.organizationId, job.data.scope);
      return;
    }

    const orgs = await this.organizationsRepository.find({
      where: { deletedAt: IsNull() },
      select: ['id'],
    });

    await Promise.all(
      orgs.map(async (org) => {
        const memberships = await this.membershipsRepository.find({
          where: { organizationId: org.id, status: 'active' },
          select: ['userId'],
        });
        const userIds = memberships.map((m) => m.userId);
        const scopes: ScopeKey[] = ['all', ...userIds];

        await Promise.all(
          scopes.map(async (scope) => {
            try {
              await this.recalculateScope(org.id, scope);
            } catch (error) {
              this.logger.error(
                `Falha ao recalcular projeção org=${org.id} scope=${scope}`,
                error as Error,
              );
              throw error;
            }
          }),
        );
      }),
    );
  }

  private applyCategoryScope(
    qb: ReturnType<Repository<TransactionEntity>['createQueryBuilder']>,
    scope: ScopeKey,
  ) {
    if (scope === 'all') return;
    qb.andWhere(
      new Brackets((sub) => {
        sub
          .where('category.owner_user_id IS NULL')
          .orWhere('category.owner_user_id = :uid', { uid: scope });
      }),
    );
  }

  private async recalculateScope(organizationId: string, scope: ScopeKey) {
    const now = new Date();
    const periodStart = startOfMonth(now);
    const periodEnd = endOfMonth(now);
    const historyStart = startOfMonth(subMonths(now, 2));

    const monthlyTotals = await this.getMonthlyTotals(
      organizationId,
      scope,
      historyStart,
      periodEnd,
    );

    const monthKeys = [0, 1, 2].map((offset) =>
      format(startOfMonth(subMonths(now, offset)), 'yyyy-MM'),
    );
    const incomes = monthKeys.map((key) => monthlyTotals.get(key)?.income ?? 0);
    const expenses = monthKeys.map((key) => monthlyTotals.get(key)?.expense ?? 0);

    const projectedIncome = this.applyWeights(incomes);
    const projectedExpense = this.applyWeights(expenses);
    // Coluna `initial_balance` foi removida; saldo inicial entra via transações de ajuste.
    const projectedBalance = Number((projectedIncome - projectedExpense).toFixed(2));

    const trend = this.calculateTrend(incomes, expenses);

    await this.saveProjection(
      organizationId,
      scope,
      periodStart,
      periodEnd,
      projectedIncome,
      projectedExpense,
      projectedBalance,
      trend,
    );

    if (projectedBalance < 0) {
      await this.enqueueNegativeBalanceAlert(organizationId, scope, projectedBalance, periodStart);
    }
  }

  private async getMonthlyTotals(organizationId: string, scope: ScopeKey, start: Date, end: Date) {
    const qb = this.transactionsRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.category', 'category')
      .select("DATE_TRUNC('month', transaction.occurred_at)", 'period')
      .addSelect('transaction.direction', 'direction')
      .addSelect('SUM(CAST(transaction.amount AS numeric))', 'total')
      .where('transaction.deleted_at IS NULL')
      .andWhere('transaction.organization_id = :organizationId', { organizationId })
      .andWhere('transaction.occurred_at BETWEEN :start AND :end', { start, end });
    this.applyCategoryScope(qb, scope);

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

  private applyWeights(values: number[]): number {
    return Number(
      values
        .reduce((acc, value, index) => acc + value * (PROJECTION_WEIGHTS[index] ?? 0), 0)
        .toFixed(2),
    );
  }

  private calculateTrend(incomes: number[], expenses: number[]) {
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

  private async saveProjection(
    organizationId: string,
    scope: ScopeKey,
    periodStart: Date,
    periodEnd: Date,
    projectedIncome: number,
    projectedExpense: number,
    projectedBalance: number,
    trend: 'up' | 'flat' | 'down',
  ) {
    const where =
      scope === 'all'
        ? { organizationId, scopeUserId: IsNull(), periodStart }
        : { organizationId, scopeUserId: Equal(scope), periodStart };

    let projection = await this.projectionsRepository.findOne({ where });

    if (!projection) {
      projection = this.projectionsRepository.create({
        organizationId,
        scopeUserId: scope === 'all' ? null : scope,
        periodStart,
        periodEnd,
      });
    }

    projection.periodEnd = periodEnd;
    projection.projectedIncome = projectedIncome.toFixed(2);
    projection.projectedExpense = projectedExpense.toFixed(2);
    projection.projectedBalance = projectedBalance.toFixed(2);
    projection.trend = trend;
    projection.generatedAt = new Date();

    await this.projectionsRepository.save(projection);
  }

  private async enqueueNegativeBalanceAlert(
    organizationId: string,
    scope: ScopeKey,
    projectedBalance: number,
    periodStart: Date,
  ) {
    const jobId = `negative-balance:${organizationId}:${scope}:${format(periodStart, 'yyyy-MM')}`;
    try {
      await this.alertsQueue.add(
        'negative-balance',
        {
          organizationId,
          scope,
          projectedBalance,
          month: format(periodStart, 'yyyy-MM'),
          generatedAt: new Date().toISOString(),
        },
        {
          jobId,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch (error) {
      const message = (error as Error).message;
      if (!message.includes('Job')) {
        this.logger.warn(`Falha ao agendar alerta de saldo negativo (${jobId}): ${message}`);
      }
    }
  }
}
