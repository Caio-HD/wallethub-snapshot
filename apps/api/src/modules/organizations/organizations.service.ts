import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { OrganizationMembershipEntity } from '../../database/entities/organization-membership.entity';
import { UserEntity } from '../../database/entities/user.entity';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';
import { EntitlementsService } from '../plan-entitlements/entitlements.service';
import type { OrganizationPlan } from '../../database/entities/organization.entity';
import { messagingAiMemberSeatLimit } from '../plan-entitlements/plan-capabilities';

export type OrganizationMemberListRow = {
  userId: string;
  name: string;
  email: string | null;
  role: OrganizationMembershipEntity['role'];
  messagingAiEnabled: boolean;
};

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(OrganizationMembershipEntity)
    private readonly membershipsRepository: Repository<OrganizationMembershipEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizationsRepository: Repository<OrganizationEntity>,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async listForUser(
    userId: string,
    options: { elevated?: boolean } = {},
  ): Promise<Pick<OrganizationEntity, 'id' | 'name' | 'plan'>[]> {
    // Platform operator (super_admin with elevated access): list every org for impersonation.
    if (options.elevated) {
      // @DeleteDateColumn makes find() exclude soft-deleted orgs automatically.
      const orgs = await this.organizationsRepository.find({ order: { name: 'ASC' } });
      return orgs.map((o) => ({ id: o.id, name: o.name, plan: o.plan }));
    }
    const memberships = await this.membershipsRepository.find({
      where: { userId, status: 'active' },
      relations: { organization: true },
      order: { organization: { name: 'ASC' } },
    });
    return memberships
      .filter((m) => !m.deletedAt && !m.organization.deletedAt)
      .map((m) => ({
        id: m.organizationId,
        name: m.organization.name,
        plan: m.organization.plan,
      }));
  }

  async resolveActiveOrganization(
    userId: string,
    headerOrganizationId?: string,
    options: { elevated?: boolean } = {},
  ): Promise<ActiveOrganizationContext> {
    // Platform operator: resolve any existing org by header WITHOUT a membership check
    // (impersonation). Falls back to normal behavior when elevation is not allowed (kill-switch
    // off / no MFA), which is the single read gate validated by the architectural isolation test.
    if (options.elevated) {
      if (!headerOrganizationId) {
        throw new BadRequestException(
          'Selecione uma organização para auditar (cabeçalho X-Organization-Id).',
        );
      }
      const org = await this.organizationsRepository.findOne({
        where: { id: headerOrganizationId },
      });
      if (!org || org.deletedAt) {
        throw new NotFoundException('Organização não encontrada');
      }
      return { id: org.id, plan: org.plan, impersonated: true };
    }

    const memberships = await this.membershipsRepository.find({
      where: { userId, status: 'active' },
      relations: { organization: true },
      order: { createdAt: 'ASC' },
    });
    const active = memberships.filter((m) => !m.deletedAt && !m.organization.deletedAt);
    if (active.length === 0) {
      throw new ForbiddenException('Sem organizações associadas');
    }
    if (headerOrganizationId) {
      const found = active.find((m) => m.organizationId === headerOrganizationId);
      if (!found) {
        throw new ForbiddenException('Organização inválida ou sem acesso');
      }
      return { id: found.organizationId, plan: found.organization.plan };
    }
    if (active.length === 1) {
      const m = active[0];
      return { id: m.organizationId, plan: m.organization.plan };
    }
    throw new BadRequestException(
      'Várias organizações: envie o cabeçalho X-Organization-Id com o UUID da organização activa.',
    );
  }

  /**
   * WhatsApp/Telegram sem cabeçalho HTTP: usa a primeira membership activa (ordem de criação).
   * Evita bloquear canais legacy quando o utilizador tem várias organizações.
   */
  async resolveOrganizationForLegacyChannel(userId: string): Promise<ActiveOrganizationContext> {
    const memberships = await this.membershipsRepository.find({
      where: { userId, status: 'active' },
      relations: { organization: true },
      order: { createdAt: 'ASC' },
    });
    const active = memberships.filter((m) => !m.deletedAt && !m.organization.deletedAt);
    if (active.length === 0) {
      throw new ForbiddenException('Sem organizações associadas');
    }
    const m = active[0];
    return { id: m.organizationId, plan: m.organization.plan };
  }

  /** Utilizadores activos da organização (ordem de membership) para projeções e âmbitos. */
  async getMemberUserIdsOrdered(organizationId: string): Promise<string[]> {
    const rows = await this.membershipsRepository.find({
      where: { organizationId, status: 'active' },
      order: { createdAt: 'ASC' },
    });
    return rows.filter((r) => !r.deletedAt).map((r) => r.userId);
  }

  async getOrganizationIfMember(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationEntity | null> {
    const m = await this.membershipsRepository.findOne({
      where: { userId, organizationId, status: 'active' },
      relations: { organization: true },
    });
    if (!m?.organization || m.deletedAt || m.organization.deletedAt) {
      return null;
    }
    return m.organization;
  }

  async isActiveMember(userId: string, organizationId: string): Promise<boolean> {
    const org = await this.getOrganizationIfMember(userId, organizationId);
    return org != null;
  }

  async assertUserInOrganization(userId: string, organizationId: string): Promise<void> {
    const ok = await this.isActiveMember(userId, organizationId);
    if (!ok) {
      throw new ForbiddenException('Utilizador não pertence a esta organização');
    }
  }

  async getActiveMembership(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMembershipEntity | null> {
    return this.membershipsRepository.findOne({
      where: { organizationId, userId, status: 'active' },
    });
  }

  async assertOrgOwnerOrAdmin(userId: string, organizationId: string): Promise<void> {
    const m = await this.getActiveMembership(organizationId, userId);
    if (!m || m.deletedAt) {
      throw new ForbiddenException('Sem acesso a esta organização');
    }
    if (m.role !== 'owner' && m.role !== 'admin') {
      throw new ForbiddenException('Apenas owner ou admin podem gerir vagas de IA.');
    }
  }

  async listMembersWithDetails(organizationId: string): Promise<OrganizationMemberListRow[]> {
    const rows = await this.membershipsRepository.find({
      where: { organizationId, status: 'active' },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    return rows
      .filter((m) => !m.deletedAt && m.user && !m.user.deletedAt)
      .map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email ?? null,
        role: m.role,
        messagingAiEnabled: m.messagingAiEnabled,
      }));
  }

  async patchMemberMessagingAiEnabled(params: {
    actorUserId: string;
    organizationId: string;
    plan: OrganizationPlan;
    targetUserId: string;
    enabled: boolean;
  }): Promise<OrganizationMemberListRow> {
    const { actorUserId, organizationId, plan, targetUserId, enabled } = params;
    await this.assertOrgOwnerOrAdmin(actorUserId, organizationId);

    const target = await this.getActiveMembership(organizationId, targetUserId);
    if (!target || target.deletedAt) {
      throw new NotFoundException('Membro não encontrado');
    }
    if (target.role !== 'member') {
      throw new BadRequestException(
        'Vagas de IA aplicam-se apenas a membros com papel "member". Owners e admins já têm IA.',
      );
    }

    if (enabled && !target.messagingAiEnabled) {
      await this.entitlementsService.assertCanEnableMessagingAiMemberSeat(organizationId, plan);
    }

    target.messagingAiEnabled = enabled;
    await this.membershipsRepository.save(target);

    const user = await this.usersRepository.findOne({ where: { id: targetUserId } });
    return {
      userId: target.userId,
      name: user?.name ?? '',
      email: user?.email ?? null,
      role: target.role,
      messagingAiEnabled: target.messagingAiEnabled,
    };
  }

  getMessagingAiSeatInfo(plan: OrganizationPlan): { limit: number; label: string } {
    const limit = messagingAiMemberSeatLimit[plan];
    return {
      limit,
      label: plan === 'plus' ? 'Plus' : plan === 'pro' ? 'Pro' : 'Free',
    };
  }

  /** Membros activos para seletor de âmbito (inclui metadados de membership). */
  async listActiveMembersForSelector(organizationId: string): Promise<
    Array<{
      id: string;
      name: string;
      isActive: boolean;
      membershipRole: OrganizationMembershipEntity['role'];
      messagingAiEnabled: boolean;
    }>
  > {
    const rows = await this.membershipsRepository.find({
      where: { organizationId, status: 'active' },
      relations: { user: true },
      order: { user: { name: 'ASC' } },
    });
    return rows
      .filter((m) => !m.deletedAt && m.user && !m.user.deletedAt && m.user.isActive)
      .map((m) => ({
        id: m.userId,
        name: m.user.name,
        isActive: m.user.isActive,
        membershipRole: m.role,
        messagingAiEnabled: m.messagingAiEnabled,
      }));
  }

  async updateOrganizationName(
    userId: string,
    organizationId: string,
    name: string,
  ): Promise<Pick<OrganizationEntity, 'id' | 'name' | 'plan'>> {
    const m = await this.membershipsRepository.findOne({
      where: { userId, organizationId, status: 'active' },
      relations: { organization: true },
    });
    if (!m || m.deletedAt || !m.organization || m.organization.deletedAt) {
      throw new ForbiddenException('Organização inválida ou sem acesso');
    }
    if (m.role !== 'owner' && m.role !== 'admin') {
      throw new ForbiddenException('Apenas owner ou admin podem alterar o nome da organização');
    }
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Nome obrigatório');
    }
    m.organization.name = trimmed.slice(0, 128);
    await this.membershipsRepository.manager.save(m.organization);
    return {
      id: m.organization.id,
      name: m.organization.name,
      plan: m.organization.plan,
    };
  }
}
