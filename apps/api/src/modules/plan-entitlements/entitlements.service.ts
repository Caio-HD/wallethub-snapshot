import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { OrganizationPlan } from '../../database/entities/organization.entity';
import { OrganizationUsageCounterEntity } from '../../database/entities/organization-usage-counter.entity';
import { OrganizationMembershipEntity } from '../../database/entities/organization-membership.entity';
import {
  aiMessagingAssistantMonthlyLimit,
  messagingAiMemberSeatLimit,
  minPlanForCapability,
  organizationPlanMeets,
  PlanCapability,
} from './plan-capabilities';

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(OrganizationUsageCounterEntity)
    private readonly usageRepository: Repository<OrganizationUsageCounterEntity>,
    @InjectRepository(OrganizationMembershipEntity)
    private readonly membershipRepository: Repository<OrganizationMembershipEntity>,
  ) {}

  assertCapability(plan: OrganizationPlan, capability: PlanCapability): void {
    if (!organizationPlanMeets(plan, capability)) {
      throw new ForbiddenException(
        `Funcionalidade disponível a partir do plano ${this.describeMinPlan(capability)}.`,
      );
    }
  }

  private describeMinPlan(capability: PlanCapability): string {
    const min = minPlanForCapability[capability];
    if (min === 'plus') return 'Plus';
    if (min === 'pro') return 'Pro';
    return 'Free';
  }

  currentPeriodYyyymm(): string {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  async assertAiMessagingAssistantAllowed(
    organizationId: string,
    plan: OrganizationPlan,
  ): Promise<void> {
    const limit = aiMessagingAssistantMonthlyLimit[plan];
    if (limit <= 0) {
      throw new ForbiddenException('IA assistente não disponível neste plano.');
    }
    const period = this.currentPeriodYyyymm();
    const row = await this.getOrCreateUsageRow(organizationId, period);
    if (row.aiMessagingAssistantMessages >= limit) {
      throw new ForbiddenException('Limite mensal de mensagens IA atingido.');
    }
  }

  /** Owner e admin usam IA sem vaga; membros precisam de `messagingAiEnabled`. */
  assertMessagingAiSeatForMembership(membership: OrganizationMembershipEntity): void {
    if (membership.role === 'owner' || membership.role === 'admin') {
      return;
    }
    if (membership.messagingAiEnabled) {
      return;
    }
    throw new ForbiddenException(
      'Este utilizador não tem vaga de IA nesta organização. Peça a um administrador para atribuir uma vaga.',
    );
  }

  async countMemberMessagingAiSeatsInUse(organizationId: string): Promise<number> {
    return this.membershipRepository.count({
      where: {
        organizationId,
        status: 'active',
        role: 'member',
        messagingAiEnabled: true,
        deletedAt: IsNull(),
      },
    });
  }

  async assertCanEnableMessagingAiMemberSeat(
    organizationId: string,
    plan: OrganizationPlan,
  ): Promise<void> {
    const limit = messagingAiMemberSeatLimit[plan];
    const inUse = await this.countMemberMessagingAiSeatsInUse(organizationId);
    if (inUse >= limit) {
      throw new ForbiddenException(
        `Limite de vagas de IA para membros atingido (${limit} no plano actual).`,
      );
    }
  }

  /**
   * Gating completo para chat IA (web ou mensagens): plano, quota mensal e vaga por utilizador.
   */
  async assertWebOrMessagingAiChatAllowed(
    organizationId: string,
    plan: OrganizationPlan,
    userId: string,
  ): Promise<void> {
    this.assertCapability(plan, PlanCapability.messagingAiInsights);
    const membership = await this.membershipRepository.findOne({
      where: { organizationId, userId, status: 'active', deletedAt: IsNull() },
    });
    if (!membership) {
      throw new ForbiddenException('Sem acesso a esta organização.');
    }
    this.assertMessagingAiSeatForMembership(membership);
    await this.assertAiMessagingAssistantAllowed(organizationId, plan);
  }

  async incrementAiMessagingAssistantCount(organizationId: string): Promise<void> {
    const period = this.currentPeriodYyyymm();
    const row = await this.getOrCreateUsageRow(organizationId, period);
    row.aiMessagingAssistantMessages += 1;
    await this.usageRepository.save(row);
  }

  async incrementStatementImportCount(organizationId: string): Promise<void> {
    const period = this.currentPeriodYyyymm();
    const row = await this.getOrCreateUsageRow(organizationId, period);
    row.statementImports += 1;
    await this.usageRepository.save(row);
  }

  private async getOrCreateUsageRow(
    organizationId: string,
    periodYyyymm: string,
  ): Promise<OrganizationUsageCounterEntity> {
    let row = await this.usageRepository.findOne({
      where: { organizationId, periodYyyymm },
    });
    if (!row) {
      row = this.usageRepository.create({
        organizationId,
        periodYyyymm,
        aiMessagingAssistantMessages: 0,
        statementImports: 0,
      });
      row = await this.usageRepository.save(row);
    }
    return row;
  }
}
