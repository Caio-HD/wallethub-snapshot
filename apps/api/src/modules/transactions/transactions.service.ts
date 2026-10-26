import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, In } from 'typeorm';
import { normalizeDescriptionKey } from '../statement-import/statement-row-utils';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { TransactionAuditEntity } from '../../database/entities/transaction-audit.entity.js';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { AccountEntity } from '../../database/entities/account.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { DebtInstallmentEntity } from '../../database/entities/debt-installment.entity.js';
import { OrganizationEntity } from '../../database/entities/organization.entity.js';
import { WhatsAppEventEntity } from '../../database/entities/whatsapp-event.entity.js';
import { TelegramEventEntity } from '../../database/entities/telegram-event.entity.js';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { QUEUE_PROJECTIONS } from '../../queues';
import { StatementCategoryMappingService } from '../statement-import/statement-category-mapping.service';
import { CategoriesService } from '../categories/categories.service';
import type { CategoryType } from '../../database/entities/category.entity.js';
import type { TransactionDirection } from '../../database/entities/transaction.entity.js';

/** Direção da transação derivada do tipo da categoria (fonte única — DRY). */
function directionFromCategoryType(type: CategoryType): TransactionDirection {
  if (type === 'income') return 'income';
  if (type === 'transfer') return 'transfer';
  return 'expense';
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepository: Repository<TransactionEntity>,
    @InjectRepository(TransactionAuditEntity)
    private readonly auditRepository: Repository<TransactionAuditEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoriesRepository: Repository<CategoryEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountsRepository: Repository<AccountEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(DebtInstallmentEntity)
    private readonly debtInstallmentsRepository: Repository<DebtInstallmentEntity>,
    @InjectQueue(QUEUE_PROJECTIONS)
    private readonly projectionsQueue: Queue<{ transactionId: string }>,
    private readonly categoryMappings: StatementCategoryMappingService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async findAll(filter: FilterTransactionsDto): Promise<TransactionEntity[]> {
    const qb = this.transactionsRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.account', 'account')
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('transaction.user', 'user')
      .leftJoinAndSelect('transaction.whatsAppEvent', 'whatsAppEvent')
      .where('transaction.deletedAt IS NULL');

    if (filter.organizationId) {
      qb.andWhere('transaction.organization_id = :organizationId', {
        organizationId: filter.organizationId,
      });
    }
    if (filter.accountId) {
      qb.andWhere('transaction.account_id = :accountId', { accountId: filter.accountId });
    }
    if (filter.categoryId) {
      qb.andWhere('transaction.category_id = :categoryId', { categoryId: filter.categoryId });
    }
    if (filter.userId) {
      qb.andWhere('transaction.user_id = :userId', { userId: filter.userId });
    }
    if (filter.scopeUserId) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('category.owner_user_id IS NULL')
            .orWhere('category.owner_user_id = :scopeUserId', { scopeUserId: filter.scopeUserId });
        }),
      );
      // Adicionando filtro por donos da conta
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('account.owner_user_ids IS NULL')
            .orWhere(':scopeUserId = ANY(account.owner_user_ids)', {
              scopeUserId: filter.scopeUserId,
            });
        }),
      );
    }
    if (filter.range?.start) {
      qb.andWhere('transaction.occurred_at >= :start', { start: filter.range.start });
    }
    if (filter.range?.end) {
      qb.andWhere('transaction.occurred_at <= :end', { end: filter.range.end });
    }

    qb.orderBy('transaction.occurred_at', 'DESC');

    return qb.getMany();
  }

  async create(dto: CreateTransactionDto, organizationId: string): Promise<TransactionEntity> {
    if (!dto.userId) {
      throw new ConflictException('Usuário responsável obrigatório');
    }

    const [category, account, user] = await Promise.all([
      this.categoriesRepository.findOne({
        where: { id: dto.categoryId, organizationId },
      }),
      this.accountsRepository.findOne({
        where: { id: dto.accountId, organizationId },
      }),
      this.usersRepository.findOne({ where: { id: dto.userId } }),
    ]);

    if (!category) throw new NotFoundException('Categoria não encontrada');
    if (!account) throw new NotFoundException('Conta não encontrada');
    if (!user) throw new NotFoundException('Usuário não encontrado');

    // Transferências são movimentos pareados/neutros — usam o endpoint dedicado, que monta
    // os legs com sinal de caixa correto. Bloquear aqui evita uma transação 'transfer' órfã
    // (sem leg) que quebraria o cálculo de saldo.
    if (category.type === 'transfer') {
      throw new BadRequestException(
        'Categoria de transferência exige o endpoint de transferência (POST /transactions/transfer).',
      );
    }

    const source = dto.source ?? 'web';
    const transaction = this.transactionsRepository.create({
      occurredAt: new Date(dto.occurredAt),
      account,
      category,
      user,
      organizationId,
      organization: { id: organizationId } as OrganizationEntity,
      direction: directionFromCategoryType(category.type),
      amount: dto.amount.toFixed(2),
      description: dto.description,
      externalId: dto.externalId ?? null,
      statementImportBatchId: dto.statementImportBatchId ?? null,
      source,
      whatsAppEvent: dto.whatsappEventId
        ? ({ id: dto.whatsappEventId } as WhatsAppEventEntity)
        : undefined,
      telegramEvent: dto.telegramEventId
        ? ({ id: dto.telegramEventId } as TelegramEventEntity)
        : undefined,
      lockedUntil:
        source === 'whatsapp' || source === 'telegram'
          ? new Date(Date.now() + 2 * 60 * 60 * 1000)
          : undefined,
    });

    const saved = await this.transactionsRepository.save(transaction);
    await this.enqueueProjectionRecalculation(saved.id);
    return saved;
  }

  /**
   * Cria uma transferência (movimento neutro — não conta como receita/despesa, só afeta saldo).
   * Dois modos:
   *  - Pareado: `fromAccountId` + `toAccountId` → 2 legs (out na origem, in no destino) ligados
   *    por `transfer_group_id`; soma zero entre contas.
   *  - Leg único: `accountId` + `leg` → 1 leg (destino não rastreado: fatura externa, abertura
   *    de saldo). `transfer_group_id` próprio sem contraparte.
   * Retorna os legs criados.
   */
  async createTransfer(
    dto: CreateTransferDto,
    organizationId: string,
  ): Promise<TransactionEntity[]> {
    if (!dto.userId) {
      throw new ConflictException('Usuário responsável obrigatório');
    }
    const paired = !!dto.fromAccountId && !!dto.toAccountId;
    const single = !!dto.accountId && !!dto.leg;
    if (paired === single) {
      throw new BadRequestException(
        'Informe (fromAccountId + toAccountId) para transferência entre contas, ou ' +
          '(accountId + leg) para leg único.',
      );
    }
    if (paired && dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('Conta de origem e destino devem ser diferentes.');
    }

    const user = await this.usersRepository.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const accountIds = paired ? [dto.fromAccountId!, dto.toAccountId!] : [dto.accountId!];
    const accounts = await this.accountsRepository.find({
      where: { id: In(accountIds), organizationId },
    });
    if (accounts.length !== accountIds.length) {
      throw new NotFoundException('Conta não encontrada');
    }
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    const transferCategory = (await this.categoriesService.ensureSystemCategories(organizationId))
      .transfer;
    const transferGroupId = randomUUID();
    const amount = dto.amount.toFixed(2);
    const occurredAt = new Date(dto.occurredAt);

    const legSpecs: Array<{ accountId: string; leg: 'out' | 'in' }> = paired
      ? [
          { accountId: dto.fromAccountId!, leg: 'out' },
          { accountId: dto.toAccountId!, leg: 'in' },
        ]
      : [{ accountId: dto.accountId!, leg: dto.leg! }];

    const legs = legSpecs.map((spec) =>
      this.transactionsRepository.create({
        occurredAt,
        account: accountById.get(spec.accountId)!,
        category: transferCategory,
        user,
        organizationId,
        organization: { id: organizationId } as OrganizationEntity,
        direction: 'transfer' as const,
        transferGroupId,
        transferLeg: spec.leg,
        amount,
        description: dto.description,
        source: 'web' as const,
        statementImportBatchId: dto.statementImportBatchId ?? null,
        externalId: dto.externalId ?? null,
      }),
    );

    const saved = await this.transactionsRepository.save(legs);
    await Promise.all(saved.map((t) => this.enqueueProjectionRecalculation(t.id)));
    return saved;
  }

  async update(
    id: string,
    dto: UpdateTransactionDto,
    actorId: string,
    underImpersonation = false,
  ): Promise<TransactionEntity> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id },
      relations: ['category', 'account', 'user'],
      withDeleted: false,
    });
    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }

    // Legs de transferência têm contraparte pareada; editar uma perna isolada dessincronizaria
    // o par. Nesta fase, transferências se ajustam removendo (remove ambos os legs) e recriando.
    if (transaction.direction === 'transfer') {
      throw new BadRequestException(
        'Transferências não podem ser editadas — remova e recrie pelo endpoint de transferência.',
      );
    }

    if (
      (transaction.source === 'whatsapp' || transaction.source === 'telegram') &&
      transaction.lockedUntil &&
      transaction.lockedUntil > new Date()
    ) {
      throw new ConflictException('Transações oriundas de mensagens só podem ser editadas após 2h');
    }

    await this.assertNotLinkedToDebt(id);

    const previous = { ...transaction };

    let recategorizedTo: CategoryEntity | null = null;
    if (dto.categoryId) {
      const category = await this.categoriesRepository.findOne({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException('Categoria não encontrada');
      if (category.type === 'transfer') {
        throw new BadRequestException(
          'Não é possível recategorizar para uma categoria de transferência.',
        );
      }
      if (previous.category?.id !== category.id) {
        recategorizedTo = category;
      }
      transaction.category = category;
      transaction.direction = directionFromCategoryType(category.type);
    }

    if (dto.accountId) {
      const account = await this.accountsRepository.findOne({ where: { id: dto.accountId } });
      if (!account) throw new NotFoundException('Conta não encontrada');
      transaction.account = account;
    }

    if (dto.occurredAt) {
      transaction.occurredAt = new Date(dto.occurredAt);
    }

    if (dto.amount !== undefined) {
      transaction.amount = dto.amount.toFixed(2);
    }

    if (dto.description !== undefined) {
      transaction.description = dto.description;
    }

    const saved = await this.transactionsRepository.save(transaction);

    // Loop de aprendizado: reclassificar manualmente uma transação ensina o
    // mapeamento descrição→categoria para próximas importações. Pula categorias
    // de sistema ("Sem categoria") para não poluir o mapa com o destino neutro.
    if (recategorizedTo && !recategorizedTo.isSystem && saved.description?.trim()) {
      await this.categoryMappings.upsert(
        saved.organizationId,
        saved.description,
        recategorizedTo.id,
      );
    }

    await this.auditRepository.save(
      this.auditRepository.create({
        transaction,
        changedAt: new Date(),
        changedBy: this.usersRepository.create({ id: actorId }),
        oldValues: this.sanitizeAudit(previous),
        newValues: this.sanitizeAudit(saved),
        underImpersonation,
      }),
    );

    await this.enqueueProjectionRecalculation(transaction.id);
    return saved;
  }

  async remove(id: string, actorId: string, underImpersonation = false): Promise<void> {
    const transaction = await this.transactionsRepository.findOne({ where: { id } });
    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }

    if (
      (transaction.source === 'whatsapp' || transaction.source === 'telegram') &&
      transaction.lockedUntil &&
      transaction.lockedUntil > new Date()
    ) {
      throw new ConflictException(
        'Transações oriundas de mensagens só podem ser removidas após 2h',
      );
    }

    await this.assertNotLinkedToDebt(id);

    // Transferência: remover um leg sozinho deixaria o par desbalanceado. Remove o grupo inteiro.
    const toRemove =
      transaction.direction === 'transfer' && transaction.transferGroupId
        ? await this.transactionsRepository.find({
            where: { transferGroupId: transaction.transferGroupId },
          })
        : [transaction];

    await this.transactionsRepository.softRemove(toRemove);
    await this.auditRepository.save(
      toRemove.map((t) =>
        this.auditRepository.create({
          transaction: this.transactionsRepository.create({ id: t.id }),
          changedAt: new Date(),
          changedBy: this.usersRepository.create({ id: actorId }),
          oldValues: this.sanitizeAudit(t),
          newValues: { deleted: true },
          underImpersonation,
        }),
      ),
    );
    await Promise.all(toRemove.map((t) => this.enqueueProjectionRecalculation(t.id)));
  }

  /**
   * Remove (soft) todos os legs de uma transferência pelo `transfer_group_id`. Usado para reverter
   * a transferência de caixa vinculada a um movimento de investimento ao apagá-lo. No-op se o grupo
   * já não tiver legs vivos (idempotente).
   */
  async removeByTransferGroup(
    transferGroupId: string,
    actorId: string,
    underImpersonation = false,
  ): Promise<void> {
    const legs = await this.transactionsRepository.find({ where: { transferGroupId } });
    if (legs.length === 0) return;

    await this.transactionsRepository.softRemove(legs);
    await this.auditRepository.save(
      legs.map((t) =>
        this.auditRepository.create({
          transaction: this.transactionsRepository.create({ id: t.id }),
          changedAt: new Date(),
          changedBy: this.usersRepository.create({ id: actorId }),
          oldValues: this.sanitizeAudit(t),
          newValues: { deleted: true },
          underImpersonation,
        }),
      ),
    );
    await Promise.all(legs.map((t) => this.enqueueProjectionRecalculation(t.id)));
  }

  /**
   * Transações ainda em categoria de sistema ("Sem categoria"), agrupadas pela
   * descrição normalizada + direção — para categorização em lote por merchant.
   */
  async findUncategorizedGroups(
    organizationId: string,
    accountId?: string,
  ): Promise<
    Array<{
      descriptionKey: string;
      descriptionSample: string;
      direction: 'income' | 'expense' | 'transfer';
      count: number;
      totalAmount: string;
      transactionIds: string[];
    }>
  > {
    const qb = this.transactionsRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.category', 'category')
      .where('t.deletedAt IS NULL')
      .andWhere('t.organization_id = :organizationId', { organizationId })
      .andWhere('category.is_system = true')
      .orderBy('t.occurred_at', 'DESC');
    if (accountId) {
      qb.andWhere('t.account_id = :accountId', { accountId });
    }
    const txs = await qb.getMany();

    const groups = new Map<
      string,
      {
        descriptionKey: string;
        descriptionSample: string;
        direction: 'income' | 'expense' | 'transfer';
        count: number;
        total: number;
        transactionIds: string[];
      }
    >();
    for (const t of txs) {
      const description = t.description?.trim() || 'Sem descrição';
      const key = normalizeDescriptionKey(description) || description.toLowerCase();
      const groupKey = `${t.direction}|${key}`;
      const existing = groups.get(groupKey);
      const amount = Number(t.amount);
      if (existing) {
        existing.count += 1;
        existing.total += amount;
        existing.transactionIds.push(t.id);
      } else {
        groups.set(groupKey, {
          descriptionKey: key,
          descriptionSample: description,
          direction: t.direction,
          count: 1,
          total: amount,
          transactionIds: [t.id],
        });
      }
    }

    return Array.from(groups.values())
      .sort((a, b) => b.count - a.count)
      .map((g) => ({
        descriptionKey: g.descriptionKey,
        descriptionSample: g.descriptionSample,
        direction: g.direction,
        count: g.count,
        totalAmount: g.total.toFixed(2),
        transactionIds: g.transactionIds,
      }));
  }

  /**
   * Categoriza várias transações de uma vez. Reusa update() por transação
   * (que aprende o mapeamento descrição→categoria e respeita o bloqueio de dívida).
   * Transações ligadas a dívida são puladas e reportadas.
   */
  async bulkCategorize(
    organizationId: string,
    transactionIds: string[],
    categoryId: string,
    actorId: string,
    underImpersonation = false,
  ): Promise<{ updated: number; skipped: Array<{ id: string; reason: string }> }> {
    const category = await this.categoriesRepository.findOne({
      where: { id: categoryId, organizationId },
    });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }
    const owned = await this.transactionsRepository.find({
      where: { id: In(transactionIds), organizationId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((t) => t.id));

    let updated = 0;
    const skipped: Array<{ id: string; reason: string }> = [];
    for (const id of transactionIds) {
      if (!ownedIds.has(id)) {
        skipped.push({ id, reason: 'Transação não encontrada nesta organização' });
        continue;
      }
      try {
        await this.update(id, { categoryId }, actorId, underImpersonation);
        updated += 1;
      } catch (e) {
        if (e instanceof ConflictException) {
          skipped.push({ id, reason: e.message });
        } else {
          throw e;
        }
      }
    }
    return { updated, skipped };
  }

  private async assertNotLinkedToDebt(transactionId: string): Promise<void> {
    const linked = await this.debtInstallmentsRepository.exist({
      where: { transactionId },
    });
    if (linked) {
      throw new ConflictException(
        'Use desfazer pagamento na dívida antes de alterar esta transação',
      );
    }
  }

  private sanitizeAudit(transaction: TransactionEntity) {
    return {
      id: transaction.id,
      occurredAt: transaction.occurredAt,
      accountId: transaction.account?.id,
      categoryId: transaction.category?.id,
      userId: transaction.user?.id,
      direction: transaction.direction,
      amount: transaction.amount,
      description: transaction.description,
      source: transaction.source,
    };
  }

  private async enqueueProjectionRecalculation(transactionId: string): Promise<void> {
    await this.projectionsQueue.add(
      'recalculate',
      { transactionId },
      {
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
