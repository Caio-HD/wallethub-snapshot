import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository, FindOptionsWhere } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { OrganizationEntity } from '../../database/entities/organization.entity.js';
import { OrganizationMembershipEntity } from '../../database/entities/organization-membership.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { AccountEntity } from '../../database/entities/account.entity.js';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { MonthlyBudgetEntity } from '../../database/entities/monthly-budget.entity.js';
import { CategoryBudgetEntity } from '../../database/entities/category-budget.entity.js';
import { ProjectionEntity } from '../../database/entities/projection.entity.js';
import { SettingEntity } from '../../database/entities/setting.entity.js';
import { InvestmentMovementEntity } from '../../database/entities/investment-movement.entity.js';
import { WhatsAppSessionEntity } from '../../database/entities/whatsapp-session.entity.js';
import { AiConversationSessionEntity } from '../../database/entities/ai-conversation-session.entity.js';
import { TelegramEventEntity } from '../../database/entities/telegram-event.entity.js';

export interface QaTenantResult {
  id: string;
  name: string;
  isQa: boolean;
  createdAt: Date;
}

export interface QaUserResult {
  id: string;
  email: string;
  tenantId: string;
  role: string;
}

export interface QaTransactionResult {
  id: string;
  amount: number;
  description: string;
  direction: string;
}

@Injectable()
export class QaAdminService {
  private readonly logger = new Logger(QaAdminService.name);

  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly orgsRepo: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationMembershipEntity)
    private readonly membershipsRepo: Repository<OrganizationMembershipEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountsRepo: Repository<AccountEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoriesRepo: Repository<CategoryEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepo: Repository<TransactionEntity>,
  ) {}

  async createQaTenant(name: string): Promise<QaTenantResult> {
    const org = this.orgsRepo.create({ name, plan: 'free', isQa: true });
    await this.orgsRepo.save(org);
    this.logger.log(`QA tenant created: ${org.id} (${name})`);
    return { id: org.id, name: org.name, isQa: org.isQa, createdAt: org.createdAt };
  }

  async deleteQaTenant(id: string, confirm?: string): Promise<void> {
    // Guarda dupla (política de não-exclusão): além do filtro isQa na busca,
    // exige confirmação explícita com o próprio id e re-verifica isQa no registro
    // retornado antes de qualquer delete.
    if (confirm !== id) {
      throw new BadRequestException(
        `Hard-delete requer confirmação explícita: query param confirm=<tenantId>`,
      );
    }
    const org = await this.orgsRepo.findOne({ where: { id, isQa: true } });
    if (!org) throw new NotFoundException(`QA tenant ${id} not found`);
    if (org.isQa !== true) {
      throw new BadRequestException(
        `Tenant ${id} não é QA (isQa=${String(org.isQa)}) — hard-delete bloqueado`,
      );
    }

    // Hard delete in dependency order to avoid FK violations
    const memberships = await this.membershipsRepo.find({ where: { organizationId: id } });
    const userIds = memberships.map((m) => m.userId);

    const manager = this.orgsRepo.manager;

    // transactions reference accounts/categories/telegram_events, so they go first
    await this.transactionsRepo.delete({ organizationId: id });
    await manager.delete(TelegramEventEntity, { organizationId: id });
    await manager.delete(InvestmentMovementEntity, { organizationId: id });
    await manager.delete(CategoryBudgetEntity, { organizationId: id });
    await manager.delete(MonthlyBudgetEntity, { organizationId: id });
    await manager.delete(ProjectionEntity, { organizationId: id });
    await manager.delete(SettingEntity, { organizationId: id });
    await manager.delete(WhatsAppSessionEntity, { organizationId: id });
    await manager.delete(AiConversationSessionEntity, { organizationId: id });
    await this.accountsRepo.delete({ organizationId: id });
    await this.categoriesRepo.delete({ organizationId: id });
    await this.membershipsRepo.delete({ organizationId: id });

    // Delete QA-only users (those who exist solely for this tenant)
    for (const userId of userIds) {
      const otherMemberships = await this.membershipsRepo.count({ where: { userId } });
      if (otherMemberships === 0) {
        await this.usersRepo.delete({ id: userId });
      }
    }

    await this.orgsRepo.delete({ id });
    this.logger.log(`QA tenant hard-deleted: ${id}`);
  }

  async listQaTenants(createdBefore?: string): Promise<QaTenantResult[]> {
    const where: FindOptionsWhere<OrganizationEntity> = { isQa: true };
    if (createdBefore) {
      where.createdAt = LessThan(new Date(createdBefore));
    }
    const orgs = await this.orgsRepo.find({ where, order: { createdAt: 'ASC' } });
    return orgs.map((o) => ({
      id: o.id,
      name: o.name,
      isQa: o.isQa,
      createdAt: o.createdAt,
    }));
  }

  async createQaUser(
    tenantId: string,
    email: string,
    password: string,
    role: 'admin' | 'member' = 'admin',
  ): Promise<QaUserResult> {
    const org = await this.orgsRepo.findOne({ where: { id: tenantId, isQa: true } });
    if (!org) throw new NotFoundException(`QA tenant ${tenantId} not found`);

    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException(`User ${email} already exists`);

    const username = email.split('@')[0];
    const passwordHash = await bcrypt.hash(password, 10);

    const user = this.usersRepo.create({
      email,
      username,
      name: `QA User (${tenantId.slice(0, 8)})`,
      passwordHash,
      isActive: true,
      emailVerified: true,
      role: 'admin' as const,
    });
    await this.usersRepo.save(user);

    const membership = this.membershipsRepo.create({
      organizationId: tenantId,
      userId: user.id,
      role: 'owner',
      status: 'active',
    });
    await this.membershipsRepo.save(membership);

    this.logger.log(`QA user created: ${user.id} in tenant ${tenantId}`);
    return { id: user.id, email: user.email ?? '', tenantId, role };
  }

  async seedTransaction(
    tenantId: string,
    description: string,
    amount: number,
    type: 'income' | 'expense',
  ): Promise<QaTransactionResult> {
    const org = await this.orgsRepo.findOne({ where: { id: tenantId, isQa: true } });
    if (!org) throw new NotFoundException(`QA tenant ${tenantId} not found`);

    // Find or create a QA account in this tenant
    let account = await this.accountsRepo.findOne({
      where: { organizationId: tenantId, name: 'QA Conta Principal' },
    });
    if (!account) {
      account = this.accountsRepo.create({
        organizationId: tenantId,
        name: 'QA Conta Principal',
        isActive: true,
      });
      await this.accountsRepo.save(account);
    }

    // Find or create a QA category
    let category = await this.categoriesRepo.findOne({
      where: { organizationId: tenantId, name: `QA ${type === 'income' ? 'Receita' : 'Despesa'}` },
    });
    if (!category) {
      const membership = await this.membershipsRepo.findOne({
        where: { organizationId: tenantId },
      });
      if (!membership) throw new NotFoundException('No member in QA tenant');

      category = this.categoriesRepo.create({
        organizationId: tenantId,
        userId: membership.userId,
        name: `QA ${type === 'income' ? 'Receita' : 'Despesa'}`,
        type,
        icon: '🧪',
      } as Partial<CategoryEntity> as CategoryEntity);
      await this.categoriesRepo.save(category);
    }

    // Find the user in this tenant
    const membership = await this.membershipsRepo.findOne({ where: { organizationId: tenantId } });
    if (!membership) throw new NotFoundException('No member in QA tenant');

    const tx = this.transactionsRepo.create({
      organizationId: tenantId,
      account,
      category,
      user: { id: membership.userId } as UserEntity,
      description,
      amount: String(amount),
      direction: type,
      occurredAt: new Date(),
      source: 'web',
    } as Partial<TransactionEntity> as TransactionEntity);
    await this.transactionsRepo.save(tx);

    return { id: tx.id, amount, description, direction: type };
  }
}
