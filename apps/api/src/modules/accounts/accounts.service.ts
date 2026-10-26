import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { isUniqueViolation, violatedConstraint } from '../../common/utils/db-error.util.js';
import { SYSTEM_TRANSFER_NAME } from '../categories/categories.service';
import { AccountEntity } from '../../database/entities/account.entity.js';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { StatementImportBatchEntity } from '../../database/entities/statement-import-batch.entity.js';
import { DebtEntity } from '../../database/entities/debt.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { OrganizationEntity } from '../../database/entities/organization.entity.js';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

/**
 * Forma canônica de um campo bancário (banco/agência/conta) para escrita e match.
 * Remove tudo que não for alfanumérico, normaliza maiúsculas e remove zeros à
 * esquerda — assim '0001234-5' (OFX) e '12345' (digitado) casam de forma estável,
 * e o índice único parcial reflete o mesmo critério. Retorna null se vazio.
 */
export function normalizeBankField(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleaned) return null;
  const trimmed = cleaned.replace(/^0+/, '');
  return trimmed || '0';
}

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountsRepository: Repository<AccountEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepository: Repository<TransactionEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoriesRepository: Repository<CategoryEntity>,
    @InjectRepository(StatementImportBatchEntity)
    private readonly batchRepository: Repository<StatementImportBatchEntity>,
    @InjectRepository(DebtEntity)
    private readonly debtsRepository: Repository<DebtEntity>,
  ) {}

  async findAll(
    userId?: string,
    organizationId?: string,
  ): Promise<(AccountEntity & { balance: string })[]> {
    const isAll = !userId || userId === 'all';

    const query = this.accountsRepository
      .createQueryBuilder('account')
      .where('account.deletedAt IS NULL');

    if (organizationId) {
      query.andWhere('account.organization_id = :organizationId', { organizationId });
    }

    if (!isAll) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('account.ownerUserIds IS NULL').orWhere(':uid = ANY(account.ownerUserIds)', {
            uid: userId,
          });
        }),
      );
    }

    const accounts = await query.orderBy('account.name', 'ASC').getMany();

    // Calculate balances for all accounts
    const results = await Promise.all(
      accounts.map(async (account) => {
        const balance = await this.calculateBalance(account.id);
        return {
          ...account,
          balance: balance.toFixed(2),
        };
      }),
    );

    return results;
  }

  private async calculateBalance(accountId: string): Promise<number> {
    const transactions = await this.transactionsRepository.find({
      where: { account: { id: accountId } },
      select: ['amount', 'direction', 'transferLeg'],
    });

    return transactions.reduce((acc, t) => {
      const val = parseFloat(t.amount);
      // Transferências (movimento neutro) afetam o saldo pelo sentido do leg: 'in' credita,
      // 'out' debita. income credita, expense debita.
      if (t.direction === 'transfer') {
        return t.transferLeg === 'in' ? acc + val : acc - val;
      }
      return t.direction === 'income' ? acc + val : acc - val;
    }, 0);
  }

  async create(
    dto: CreateAccountDto,
    userId: string,
    organizationId: string,
  ): Promise<AccountEntity> {
    const account = this.accountsRepository.create({
      name: dto.name,
      ownerUserIds: dto.ownerUserIds ?? null,
      bankId: normalizeBankField(dto.bankId),
      branchNumber: normalizeBankField(dto.branchNumber),
      accountNumber: normalizeBankField(dto.accountNumber),
      lastBalanceUpdateAt: dto.balance !== undefined ? new Date() : null,
      organizationId,
    });
    const savedAccount = await this.accountsRepository.save(account);

    if (dto.balance !== undefined && dto.balance !== 0) {
      await this.createAdjustmentTransaction(
        savedAccount.id,
        dto.balance,
        userId,
        'Ajuste de saldo inicial',
      );
    }

    return savedAccount;
  }

  async update(
    id: string,
    dto: UpdateAccountDto,
    userId: string,
    organizationId: string,
  ): Promise<AccountEntity> {
    const account = await this.accountsRepository.findOne({ where: { id, organizationId } });
    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }

    if (dto.name !== undefined) account.name = dto.name;
    if (dto.ownerUserIds !== undefined) account.ownerUserIds = dto.ownerUserIds;
    if (dto.isActive !== undefined) account.isActive = dto.isActive;
    if (dto.bankId !== undefined) account.bankId = normalizeBankField(dto.bankId);
    if (dto.branchNumber !== undefined) account.branchNumber = normalizeBankField(dto.branchNumber);
    if (dto.accountNumber !== undefined)
      account.accountNumber = normalizeBankField(dto.accountNumber);

    if (dto.balance !== undefined) {
      const currentBalance = await this.calculateBalance(id);
      const diff = dto.balance - currentBalance;

      if (Math.abs(diff) >= 0.01) {
        await this.createAdjustmentTransaction(id, diff, userId, 'Ajuste de saldo manual');
        account.lastBalanceUpdateAt = new Date();
      }
    }

    return this.accountsRepository.save(account);
  }

  /**
   * Exclui (soft-delete) uma conta SEM cascata: só remove quando não há dependências
   * vivas (transações, importações ou dívidas com `deleted_at IS NULL`). Caso contrário
   * lança 409 com a contagem por tipo, orientando a limpeza prévia (auditoria de import
   * para os lotes; remoção manual das demais). Libera os slots únicos de identidade/nome.
   */
  async remove(
    id: string,
    organizationId: string,
    actorId: string,
    underImpersonation = false,
  ): Promise<void> {
    const account = await this.accountsRepository.findOne({ where: { id, organizationId } });
    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }

    const [transactions, batches, debts] = await Promise.all([
      this.transactionsRepository.count({ where: { account: { id }, organizationId } }),
      this.batchRepository.count({ where: { accountId: id, organizationId } }),
      this.debtsRepository.count({ where: { accountId: id, organizationId } }),
    ]);

    if (transactions > 0 || batches > 0 || debts > 0) {
      const parts: string[] = [];
      if (transactions > 0) parts.push(`${transactions} lançamento(s)`);
      if (batches > 0) parts.push(`${batches} importação(ões)`);
      if (debts > 0) parts.push(`${debts} dívida(s)`);
      throw new ConflictException(
        `Conta tem ${parts.join(', ')}. Exclua as importações na auditoria e remova ` +
          `transações/dívidas restantes antes de excluir a conta.`,
      );
    }

    await this.accountsRepository.softRemove(account);
    this.logger.log(
      JSON.stringify({
        event: 'account_delete',
        accountId: id,
        organizationId,
        actorId,
        underImpersonation,
      }),
    );
  }

  /**
   * Casa uma conta da organização pelos dados bancários do OFX (banco + agência + conta).
   * Match estrito: os três campos precisam estar presentes e bater (após normalização
   * canônica idêntica à usada na escrita). Retorna null se algum campo faltar ou não casar.
   *
   * Escopo idêntico ao índice único `UQ_account_bank_branch_number` (org+bank+branch+account
   * WHERE account_number IS NOT NULL AND deleted_at IS NULL): NÃO filtra `isActive`, senão
   * uma conta apenas desativada (slot único ainda ocupado) seria vista como "não cadastrada"
   * e o auto-cadastro tentaria reinserir, violando o índice. Fonte única do match — não
   * duplicar este critério noutro módulo.
   */
  async findByBankIdentity(
    organizationId: string,
    identity: {
      bankId?: string | null;
      branchNumber?: string | null;
      accountNumber?: string | null;
    },
  ): Promise<AccountEntity | null> {
    const bankId = normalizeBankField(identity.bankId);
    const branchNumber = normalizeBankField(identity.branchNumber);
    const accountNumber = normalizeBankField(identity.accountNumber);

    if (!bankId || !branchNumber || !accountNumber) {
      return null;
    }

    return this.accountsRepository.findOne({
      where: { organizationId, bankId, branchNumber, accountNumber },
    });
  }

  /**
   * Garante uma conta para a identidade bancária do OFX, de forma idempotente e
   * segura sob concorrência (vários ficheiros do mesmo extrato em paralelo):
   *  1. casa por identidade → se achar, reativa (se inativa) e devolve;
   *  2. senão cria; se a criação colidir no índice único de identidade (corrida),
   *     re-consulta e reaproveita em vez de propagar 409; se colidir no nome,
   *     re-tenta com sufixo numérico.
   * Exige identidade completa (os três campos) — caso contrário lança, pois sem
   * isso o índice parcial permitiria duplicatas (NULL != NULL). O `create` público
   * permanece estrito (propaga 409) — esta é a porta exclusiva do auto-cadastro.
   */
  async ensureByBankIdentity(
    organizationId: string,
    userId: string,
    params: {
      name: string;
      bankId?: string | null;
      branchNumber?: string | null;
      accountNumber?: string | null;
    },
  ): Promise<AccountEntity> {
    const bankId = normalizeBankField(params.bankId);
    const branchNumber = normalizeBankField(params.branchNumber);
    const accountNumber = normalizeBankField(params.accountNumber);
    if (!bankId || !branchNumber || !accountNumber) {
      throw new BadRequestException(
        'Identidade bancária incompleta (banco, agência e conta são obrigatórios para auto-cadastro).',
      );
    }
    const identity = { bankId, branchNumber, accountNumber };

    const existing = await this.findByBankIdentity(organizationId, identity);
    if (existing) {
      return this.reactivateIfNeeded(existing);
    }

    const baseName = (params.name?.trim() || `Conta ${accountNumber}`).slice(0, 120);
    for (let attempt = 0; attempt < 5; attempt++) {
      const name = attempt === 0 ? baseName : `${baseName} (${attempt + 1})`.slice(0, 120);
      try {
        return await this.accountsRepository.save(
          this.accountsRepository.create({ name, organizationId, ...identity }),
        );
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        const constraint = violatedConstraint(e);
        // Corrida na identidade: outro ficheiro criou a mesma conta — reaproveita.
        if (constraint !== 'UQ_accounts_organization_name') {
          const raced = await this.findByBankIdentity(organizationId, identity);
          if (raced) return this.reactivateIfNeeded(raced);
        }
        // Colisão de nome: tenta o próximo sufixo.
      }
    }
    throw new ConflictException(
      'Não foi possível cadastrar a conta automaticamente (nome em uso).',
    );
  }

  private async reactivateIfNeeded(account: AccountEntity): Promise<AccountEntity> {
    if (account.isActive) return account;
    account.isActive = true;
    return this.accountsRepository.save(account);
  }

  /**
   * Reativa a conta (idempotente) — chamada no commit de importação: importar
   * lançamentos para uma conta implica que ela está em uso. No-op se já ativa
   * ou se a conta não pertencer à organização.
   */
  async reactivate(id: string, organizationId: string): Promise<void> {
    const account = await this.accountsRepository.findOne({ where: { id, organizationId } });
    if (account) {
      await this.reactivateIfNeeded(account);
    }
  }

  /** Saldo atual da conta (movimentação viva, com o sinal de cada leg). */
  async getBalance(accountId: string): Promise<number> {
    return this.calculateBalance(accountId);
  }

  /** A conta tem alguma transação viva? Usado para distinguir a primeira importação. */
  async hasTransactions(accountId: string): Promise<boolean> {
    const count = await this.transactionsRepository.count({
      where: { account: { id: accountId }, deletedAt: IsNull() },
    });
    return count > 0;
  }

  /**
   * Lançamento de abertura de saldo: movimento NEUTRO (transferência) que coloca o saldo da
   * conta no valor que o banco registra no extrato (<LEDGERBAL>). Sem ele, uma conta que já
   * tinha saldo antes da primeira importação fica torta para sempre — o extrato do banco traz
   * saldo_final, mas a soma da movimentação não chega lá.
   *
   * Idempotente por `externalId`: reimportar o mesmo arquivo não cria uma segunda abertura.
   * Se o externalId já existir, não faz nada e devolve false.
   */
  async createOpeningBalance(
    accountId: string,
    amount: number,
    userId: string,
    externalId: string,
    occurredAt: Date,
  ): Promise<boolean> {
    const existing = await this.transactionsRepository.findOne({
      where: { account: { id: accountId }, externalId, deletedAt: IsNull() },
    });
    if (existing) {
      return false;
    }
    return this.createAdjustmentTransaction(
      accountId,
      amount,
      userId,
      'Saldo de abertura',
      externalId,
      occurredAt,
    );
  }

  private async createAdjustmentTransaction(
    accountId: string,
    amount: number,
    userId: string,
    description: string,
    externalId?: string,
    occurredAt?: Date,
  ): Promise<boolean> {
    const accountRow = await this.accountsRepository.findOne({ where: { id: accountId } });
    if (!accountRow) {
      return false;
    }
    const organizationId = accountRow.organizationId;

    // Ajuste de saldo (abertura/manual) é um movimento NEUTRO (transferência): muda o saldo da
    // conta sem inflar receitas/despesas. 'in' credita, 'out' debita — pelo sinal do ajuste.
    const transferLeg = amount > 0 ? 'in' : 'out';
    const absAmount = Math.abs(amount).toFixed(2);

    // Categoria de sistema "Transferências" (find-or-create idempotente — mesma de createTransfer).
    let category = await this.categoriesRepository.findOne({
      where: { name: SYSTEM_TRANSFER_NAME, organizationId },
    });
    if (!category) {
      category = await this.categoriesRepository.save(
        this.categoriesRepository.create({
          name: SYSTEM_TRANSFER_NAME,
          type: 'transfer',
          isSystem: true,
          isActive: true,
          ownerUserId: null,
          organizationId,
        }),
      );
    }

    const transaction = this.transactionsRepository.create({
      account: { id: accountId } as AccountEntity,
      category: { id: category.id } as CategoryEntity,
      user: { id: userId } as UserEntity,
      organizationId,
      organization: { id: organizationId } as OrganizationEntity,
      direction: 'transfer',
      transferLeg,
      transferGroupId: randomUUID(),
      amount: absAmount,
      description,
      occurredAt: occurredAt ?? new Date(),
      externalId: externalId ?? null,
      source: 'web',
    });

    await this.transactionsRepository.save(transaction);
    return true;
  }
}
