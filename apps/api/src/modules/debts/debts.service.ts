import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DebtEntity } from '../../database/entities/debt.entity.js';
import { DebtInstallmentEntity } from '../../database/entities/debt-installment.entity.js';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { AccountEntity } from '../../database/entities/account.entity.js';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { OrganizationEntity } from '../../database/entities/organization.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { CreateDebtDto } from './dto/create-debt.dto.js';
import { UpdateDebtDto } from './dto/update-debt.dto.js';
import { UpdateDebtInstallmentDto, PayDebtInstallmentDto } from './dto/pay-debt-installment.dto.js';
import { buildInstallmentSchedule, computeInstallmentBaseAmount } from './debt-schedule.service.js';
import { computeDebtDerivedTotals, toDebtDetailResponse } from './debt-derivatives.util.js';
import { money2, parseMoney } from './debt-money.util.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { OrgTimezoneService } from './org-timezone.service.js';

@Injectable()
export class DebtsService {
  constructor(
    @InjectRepository(DebtEntity)
    private readonly debtsRepository: Repository<DebtEntity>,
    @InjectRepository(DebtInstallmentEntity)
    private readonly installmentsRepository: Repository<DebtInstallmentEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoriesRepository: Repository<CategoryEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountsRepository: Repository<AccountEntity>,
    private readonly dataSource: DataSource,
    private readonly alertsService: AlertsService,
    private readonly orgTimezoneService: OrgTimezoneService,
  ) {}

  async isTransactionLinked(transactionId: string): Promise<boolean> {
    const count = await this.installmentsRepository.count({
      where: { transactionId },
    });
    return count > 0;
  }

  async list(organizationId: string) {
    const debts = await this.debtsRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    const tz = await this.orgTimezoneService.resolve(organizationId);
    const today = this.orgTimezoneService.todayYmdInTimezone(tz);

    return Promise.all(
      debts.map(async (debt) => {
        const installments = await this.installmentsRepository.find({
          where: { debtId: debt.id },
          order: { sequenceNumber: 'ASC' },
        });
        return toDebtDetailResponse(debt, installments, today);
      }),
    );
  }

  async getSummary(organizationId: string) {
    const debts = await this.debtsRepository.find({
      where: { organizationId, status: 'active' },
    });
    const tz = await this.orgTimezoneService.resolve(organizationId);
    const today = this.orgTimezoneService.todayYmdInTimezone(tz);

    let totalOutstanding = 0;
    let dueThisMonth = 0;
    let dueNext7Days = 0;
    let nextDueDate: string | null = null;
    const nextDueDebts: Array<{ id: string; name: string; amount: string }> = [];

    for (const debt of debts) {
      const installments = await this.installmentsRepository.find({ where: { debtId: debt.id } });
      const derived = computeDebtDerivedTotals(installments, today);
      totalOutstanding += derived.outstanding;
      dueThisMonth += derived.dueThisMonth;
      dueNext7Days += derived.dueNext7Days;
      if (derived.nextDueDate && (!nextDueDate || derived.nextDueDate < nextDueDate)) {
        nextDueDate = derived.nextDueDate;
      }
      if (derived.nextDueDate === nextDueDate && derived.pendingCount > 0) {
        const next = installments
          .filter((i) => i.status === 'pending')
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
        if (next) {
          nextDueDebts.push({ id: debt.id, name: debt.name, amount: next.amount });
        }
      }
    }

    return {
      activeCount: debts.length,
      totalOutstanding: totalOutstanding.toFixed(2),
      dueThisMonth: dueThisMonth.toFixed(2),
      dueNext7Days: dueNext7Days.toFixed(2),
      nextDueDate,
      nextDueDebts: nextDueDebts.slice(0, 5),
    };
  }

  async findOne(organizationId: string, debtId: string) {
    const debt = await this.getDebtOrThrow(organizationId, debtId);
    const installments = await this.listInstallments(debtId);
    const tz = await this.orgTimezoneService.resolve(organizationId);
    const today = this.orgTimezoneService.todayYmdInTimezone(tz);
    return {
      ...toDebtDetailResponse(debt, installments, today),
      installments,
    };
  }

  async listInstallments(debtId: string) {
    return this.installmentsRepository.find({
      where: { debtId },
      order: { sequenceNumber: 'ASC' },
    });
  }

  async create(organizationId: string, dto: CreateDebtDto) {
    await this.assertCategory(organizationId, dto.categoryId);
    if (dto.accountId) {
      await this.assertAccount(organizationId, dto.accountId);
    }

    const installmentAmount =
      dto.installmentAmount ??
      Number.parseFloat(computeInstallmentBaseAmount(dto.principalAmount, dto.totalInstallments));

    const schedule = buildInstallmentSchedule({
      principalAmount: dto.principalAmount,
      installmentAmount,
      totalInstallments: dto.totalInstallments,
      startDate: dto.startDate,
    });

    const debt = this.debtsRepository.create({
      organizationId,
      name: dto.name.trim(),
      creditor: dto.creditor?.trim() ?? null,
      kind: 'installment',
      status: 'active',
      principalAmount: money2(dto.principalAmount),
      installmentAmount: money2(installmentAmount),
      totalInstallments: dto.totalInstallments,
      startDate: dto.startDate,
      categoryId: dto.categoryId,
      accountId: dto.accountId ?? null,
      notes: dto.notes?.trim() ?? null,
    });

    const savedDebt = await this.debtsRepository.save(debt);
    const installments = schedule.map((row) =>
      this.installmentsRepository.create({
        debtId: savedDebt.id,
        sequenceNumber: row.sequenceNumber,
        dueDate: row.dueDate,
        amount: row.amount,
        status: 'pending',
        transactionId: null,
        paidAt: null,
      }),
    );
    await this.installmentsRepository.save(installments);

    return this.findOne(organizationId, savedDebt.id);
  }

  async update(organizationId: string, debtId: string, dto: UpdateDebtDto) {
    const debt = await this.getDebtOrThrow(organizationId, debtId);
    const installments = await this.listInstallments(debtId);
    const paidCount = installments.filter((i) => i.status === 'paid').length;

    const financialFields = [
      dto.principalAmount,
      dto.installmentAmount,
      dto.totalInstallments,
      dto.startDate,
      dto.categoryId,
    ].some((v) => v !== undefined);

    if (financialFields && paidCount > 0) {
      throw new ConflictException('Não é possível alterar termos financeiros após pagamentos');
    }

    if (dto.name != null) debt.name = dto.name.trim();
    if (dto.creditor !== undefined) debt.creditor = dto.creditor?.trim() ?? null;
    if (dto.status != null) debt.status = dto.status;
    if (dto.notes !== undefined) debt.notes = dto.notes?.trim() ?? null;
    if (dto.accountId !== undefined) {
      if (dto.accountId) await this.assertAccount(organizationId, dto.accountId);
      debt.accountId = dto.accountId;
    }

    if (financialFields && paidCount === 0) {
      const principal = dto.principalAmount ?? parseMoney(debt.principalAmount);
      const total = dto.totalInstallments ?? debt.totalInstallments;
      const startDate = dto.startDate ?? debt.startDate;
      if (dto.categoryId) {
        await this.assertCategory(organizationId, dto.categoryId);
        debt.categoryId = dto.categoryId;
      }
      const installmentAmount =
        dto.installmentAmount ?? Number.parseFloat(computeInstallmentBaseAmount(principal, total));

      const schedule = buildInstallmentSchedule({
        principalAmount: principal,
        installmentAmount,
        totalInstallments: total,
        startDate,
      });

      debt.principalAmount = money2(principal);
      debt.installmentAmount = money2(installmentAmount);
      debt.totalInstallments = total;
      debt.startDate = startDate;

      await this.installmentsRepository.delete({ debtId: debt.id });
      await this.installmentsRepository.save(
        schedule.map((row) =>
          this.installmentsRepository.create({
            debtId: debt.id,
            sequenceNumber: row.sequenceNumber,
            dueDate: row.dueDate,
            amount: row.amount,
            status: 'pending',
            transactionId: null,
            paidAt: null,
          }),
        ),
      );
    }

    await this.debtsRepository.save(debt);
    return this.findOne(organizationId, debtId);
  }

  async remove(organizationId: string, debtId: string) {
    const debt = await this.getDebtOrThrow(organizationId, debtId);
    await this.alertsService.markDebtAlertsRead(debtId);
    await this.debtsRepository.softRemove(debt);
  }

  async patchInstallment(
    organizationId: string,
    debtId: string,
    installmentId: string,
    dto: UpdateDebtInstallmentDto,
  ) {
    await this.getDebtOrThrow(organizationId, debtId);
    const installment = await this.getInstallmentOrThrow(debtId, installmentId);
    if (installment.status !== 'pending') {
      throw new ConflictException('Só parcelas pendentes podem ser editadas');
    }
    if (dto.dueDate != null) installment.dueDate = dto.dueDate;
    if (dto.amount != null) installment.amount = money2(dto.amount);
    await this.installmentsRepository.save(installment);
    return installment;
  }

  async payInstallment(
    organizationId: string,
    debtId: string,
    installmentId: string,
    actorUserId: string,
    dto: PayDebtInstallmentDto = {},
  ) {
    return this.dataSource.transaction(async (manager) => {
      const installment = await manager
        .getRepository(DebtInstallmentEntity)
        .createQueryBuilder('i')
        .setLock('pessimistic_write')
        .innerJoin('i.debt', 'debt')
        .where('i.id = :installmentId', { installmentId })
        .andWhere('i.debt_id = :debtId', { debtId })
        .andWhere('debt.organization_id = :organizationId', { organizationId })
        .getOne();

      if (!installment) {
        throw new NotFoundException('Parcela não encontrada');
      }
      if (installment.status !== 'pending') {
        throw new ConflictException('Parcela já processada');
      }

      const debt = await manager.getRepository(DebtEntity).findOne({ where: { id: debtId } });
      if (!debt) throw new NotFoundException('Dívida não encontrada');

      const accountId = dto.accountId ?? debt.accountId;
      if (!accountId) {
        throw new BadRequestException('Conta de pagamento obrigatória');
      }

      const tx = await this.createPaymentTransaction(manager, {
        organizationId,
        actorUserId,
        accountId,
        categoryId: debt.categoryId,
        amount: parseMoney(installment.amount),
        occurredAt: dto.occurredAt,
        description: `Parcela ${installment.sequenceNumber}/${debt.totalInstallments} — ${debt.name}`,
      });

      installment.status = 'paid';
      installment.transactionId = tx.id;
      installment.paidAt = new Date();
      await manager.getRepository(DebtInstallmentEntity).save(installment);
      await this.refreshDebtStatus(manager, debt.id);

      return installment;
    });
  }

  async unpayInstallment(
    organizationId: string,
    debtId: string,
    installmentId: string,
    _actorUserId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const installment = await manager
        .getRepository(DebtInstallmentEntity)
        .createQueryBuilder('i')
        .setLock('pessimistic_write')
        .where('i.id = :installmentId', { installmentId })
        .andWhere('i.debt_id = :debtId', { debtId })
        .getOne();

      if (!installment) throw new NotFoundException('Parcela não encontrada');
      if (installment.status !== 'paid') {
        throw new ConflictException('Parcela não está paga');
      }

      await this.getDebtOrThrow(organizationId, debtId);

      if (installment.transactionId) {
        const txRepo = manager.getRepository(TransactionEntity);
        const tx = await txRepo.findOne({ where: { id: installment.transactionId } });
        if (tx) {
          await txRepo.softRemove(tx);
        }
      }

      installment.status = 'pending';
      installment.transactionId = null;
      installment.paidAt = null;
      await manager.getRepository(DebtInstallmentEntity).save(installment);
      await this.refreshDebtStatus(manager, debtId);

      return installment;
    });
  }

  async skipInstallment(organizationId: string, debtId: string, installmentId: string) {
    return this.dataSource.transaction(async (manager) => {
      const installment = await manager
        .getRepository(DebtInstallmentEntity)
        .createQueryBuilder('i')
        .setLock('pessimistic_write')
        .where('i.id = :installmentId', { installmentId })
        .andWhere('i.debt_id = :debtId', { debtId })
        .getOne();

      if (!installment) throw new NotFoundException('Parcela não encontrada');
      if (installment.status !== 'pending') {
        throw new ConflictException('Só parcelas pendentes podem ser ignoradas');
      }

      await this.getDebtOrThrow(organizationId, debtId);

      installment.status = 'skipped';
      await manager.getRepository(DebtInstallmentEntity).save(installment);
      await this.refreshDebtStatus(manager, debtId);
      return installment;
    });
  }

  async payRemaining(
    organizationId: string,
    debtId: string,
    actorUserId: string,
    dto: PayDebtInstallmentDto = {},
  ) {
    return this.dataSource.transaction(async (manager) => {
      const debt = await this.getDebtOrThrow(organizationId, debtId);
      const pending = await manager
        .getRepository(DebtInstallmentEntity)
        .createQueryBuilder('i')
        .setLock('pessimistic_write')
        .where('i.debt_id = :debtId', { debtId })
        .andWhere('i.status = :status', { status: 'pending' })
        .orderBy('i.due_date', 'ASC')
        .addOrderBy('i.sequence_number', 'ASC')
        .getMany();

      if (pending.length === 0) {
        throw new ConflictException('Não há parcelas pendentes');
      }

      const accountId = dto.accountId ?? debt.accountId;
      if (!accountId) {
        throw new BadRequestException('Conta de pagamento obrigatória');
      }

      const paid: DebtInstallmentEntity[] = [];
      for (const installment of pending) {
        const tx = await this.createPaymentTransaction(manager, {
          organizationId,
          actorUserId,
          accountId,
          categoryId: debt.categoryId,
          amount: parseMoney(installment.amount),
          occurredAt: dto.occurredAt,
          description: `Quitação parcela ${installment.sequenceNumber}/${debt.totalInstallments} — ${debt.name}`,
        });
        installment.status = 'paid';
        installment.transactionId = tx.id;
        installment.paidAt = new Date();
        await manager.getRepository(DebtInstallmentEntity).save(installment);
        paid.push(installment);
      }

      await this.refreshDebtStatus(manager, debtId);
      return paid;
    });
  }

  async processDueDebtAlerts(): Promise<void> {
    const pendingInstallments = await this.installmentsRepository
      .createQueryBuilder('i')
      .innerJoinAndSelect('i.debt', 'debt', 'debt.deleted_at IS NULL')
      .where('i.status = :status', { status: 'pending' })
      .andWhere('i.deleted_at IS NULL')
      .andWhere('debt.status = :debtStatus', { debtStatus: 'active' })
      .getMany();

    const byOrg = new Map<string, typeof pendingInstallments>();
    for (const row of pendingInstallments) {
      const orgId = row.debt.organizationId;
      const list = byOrg.get(orgId) ?? [];
      list.push(row);
      byOrg.set(orgId, list);
    }

    for (const [organizationId, rows] of byOrg) {
      const tz = await this.orgTimezoneService.resolve(organizationId);
      const today = this.orgTimezoneService.todayYmdInTimezone(tz);
      const windowEnd = this.addDaysYmd(today, 3);

      for (const installment of rows) {
        if (installment.dueDate < today || installment.dueDate > windowEnd) {
          continue;
        }
        const debt = installment.debt;
        if (debt.status !== 'active' || debt.deletedAt) {
          continue;
        }
        await this.alertsService.recordDebtDueSoon({
          organizationId,
          debtId: debt.id,
          debtName: debt.name,
          installmentId: installment.id,
          dueDate: installment.dueDate,
          amount: installment.amount,
        });
      }
    }
  }

  private addDaysYmd(ymd: string, days: number): string {
    const d = new Date(`${ymd}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  private async refreshDebtStatus(manager: DataSource['manager'], debtId: string): Promise<void> {
    const pendingCount = await manager.getRepository(DebtInstallmentEntity).count({
      where: { debtId, status: 'pending' },
    });
    const debt = await manager.getRepository(DebtEntity).findOne({ where: { id: debtId } });
    if (!debt) return;
    if (pendingCount === 0 && debt.status === 'active') {
      debt.status = 'paid_off';
    } else if (pendingCount > 0 && debt.status === 'paid_off') {
      debt.status = 'active';
    }
    await manager.getRepository(DebtEntity).save(debt);
  }

  private async createPaymentTransaction(
    manager: DataSource['manager'],
    input: {
      organizationId: string;
      actorUserId: string;
      accountId: string;
      categoryId: string;
      amount: number;
      occurredAt?: string;
      description: string;
    },
  ): Promise<TransactionEntity> {
    const [category, account] = await Promise.all([
      manager.getRepository(CategoryEntity).findOne({
        where: { id: input.categoryId, organizationId: input.organizationId },
      }),
      manager.getRepository(AccountEntity).findOne({
        where: { id: input.accountId, organizationId: input.organizationId },
      }),
    ]);
    if (!category) throw new NotFoundException('Categoria não encontrada');
    if (!account) throw new NotFoundException('Conta não encontrada');
    if (category.type !== 'expense') {
      throw new BadRequestException('Categoria deve ser despesa');
    }

    const tx = manager.getRepository(TransactionEntity).create({
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
      account,
      category,
      user: { id: input.actorUserId } as UserEntity,
      organizationId: input.organizationId,
      organization: { id: input.organizationId } as OrganizationEntity,
      direction: 'expense',
      amount: money2(input.amount),
      description: input.description,
      source: 'web',
    });
    return manager.getRepository(TransactionEntity).save(tx);
  }

  private async getDebtOrThrow(organizationId: string, debtId: string): Promise<DebtEntity> {
    const debt = await this.debtsRepository.findOne({ where: { id: debtId, organizationId } });
    if (!debt) throw new NotFoundException('Dívida não encontrada');
    return debt;
  }

  private async getInstallmentOrThrow(
    debtId: string,
    installmentId: string,
  ): Promise<DebtInstallmentEntity> {
    const installment = await this.installmentsRepository.findOne({
      where: { id: installmentId, debtId },
    });
    if (!installment) throw new NotFoundException('Parcela não encontrada');
    return installment;
  }

  private async assertCategory(organizationId: string, categoryId: string) {
    const category = await this.categoriesRepository.findOne({
      where: { id: categoryId, organizationId },
    });
    if (!category) throw new NotFoundException('Categoria não encontrada');
    if (category.type !== 'expense') {
      throw new BadRequestException('Categoria deve ser despesa');
    }
  }

  private async assertAccount(organizationId: string, accountId: string) {
    const account = await this.accountsRepository.findOne({
      where: { id: accountId, organizationId },
    });
    if (!account) throw new NotFoundException('Conta não encontrada');
  }
}
