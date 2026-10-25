import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, type SelectQueryBuilder } from 'typeorm';
import { OrganizationEntity } from '../../database/entities/organization.entity.js';
import { OrganizationMembershipEntity } from '../../database/entities/organization-membership.entity.js';
import type { OrganizationMembershipRole } from '../../database/entities/organization-membership.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { AccountEntity } from '../../database/entities/account.entity.js';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { PlatformAuditLogEntity } from '../../database/entities/platform-audit-log.entity.js';
import { PlatformAuditService } from './platform-audit.service.js';
import { PatchPlatformOrganizationDto } from './dto/patch-platform-organization.dto.js';
import { CreatePlatformOrganizationDto } from './dto/create-platform-organization.dto.js';
import { CreatePlatformMembershipDto } from './dto/create-platform-membership.dto.js';
import { PatchPlatformMembershipDto } from './dto/patch-platform-membership.dto.js';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PlatformAuditListItem {
  id: string;
  actorUserId: string | null;
  actorLabel: string | null;
  action: PlatformAuditLogEntity['action'];
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  organizationId: string | null;
  organizationName: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  query: Record<string, unknown> | null;
  createdAt: string;
}

function clampPage(pageRaw?: string): number {
  return Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
}
function clampLimit(limitRaw?: string): number {
  return Math.min(100, Math.max(1, parseInt(limitRaw ?? '20', 10) || 20));
}

export const AUDIT_EXPORT_MAX = 5000;

export interface AuditListParams {
  page?: string;
  limit?: string;
  entityType?: string;
  actorUserId?: string;
  organizationId?: string;
  action?: string;
  from?: string;
  to?: string;
  q?: string;
}

export interface PlatformAuditExportResult {
  items: PlatformAuditListItem[];
  total: number;
  exported: number;
  truncated: boolean;
}

/**
 * Cross-organization read/edit surface for the platform operator (super_admin). Every method is
 * reachable only behind RolesGuard('super_admin') + ElevatedAccessGuard (see controller). Writes
 * and reads of detail/list endpoints are recorded via PlatformAuditService.
 */
@Injectable()
export class AdminPlatformService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly orgs: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationMembershipEntity)
    private readonly memberships: Repository<OrganizationMembershipEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactions: Repository<TransactionEntity>,
    @InjectRepository(AccountEntity)
    private readonly accounts: Repository<AccountEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categories: Repository<CategoryEntity>,
    @InjectRepository(PlatformAuditLogEntity)
    private readonly auditLog: Repository<PlatformAuditLogEntity>,
    private readonly audit: PlatformAuditService,
  ) {}

  async listOrganizations(
    actorUserId: string,
    params: { page?: string; limit?: string; q?: string; plan?: string },
  ): Promise<Page<Record<string, unknown>>> {
    const page = clampPage(params.page);
    const limit = clampLimit(params.limit);
    const qb = this.orgs.createQueryBuilder('o');
    if (params.q?.trim()) {
      qb.andWhere('(o.name ILIKE :q OR o.legal_name ILIKE :q OR o.tax_id ILIKE :q)', {
        q: `%${params.q.trim()}%`,
      });
    }
    if (params.plan && ['free', 'pro', 'plus'].includes(params.plan)) {
      qb.andWhere('o.plan = :plan', { plan: params.plan });
    }
    qb.orderBy('o.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    const [orgs, total] = await qb.getManyAndCount();

    const items = await Promise.all(
      orgs.map(async (o) => ({
        id: o.id,
        name: o.name,
        plan: o.plan,
        isQa: o.isQa,
        memberCount: await this.memberships.count({
          where: { organizationId: o.id, status: 'active' },
        }),
        transactionCount: await this.transactions.count({ where: { organizationId: o.id } }),
        createdAt: o.createdAt,
      })),
    );

    await this.audit.record({
      actorUserId,
      action: 'read',
      entityType: 'organization',
      query: { list: true, q: params.q ?? null, plan: params.plan ?? null, page, limit, total },
    });
    return { items, total, page, limit };
  }

  private async getOrgOrThrow(id: string): Promise<OrganizationEntity> {
    const org = await this.orgs.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organização não encontrada');
    return org;
  }

  async getOrganizationDetail(actorUserId: string, id: string): Promise<Record<string, unknown>> {
    const org = await this.getOrgOrThrow(id);
    const members = await this.memberships.find({
      where: { organizationId: id, status: 'active' },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    await this.audit.record({
      actorUserId,
      action: 'read',
      entityType: 'organization',
      entityId: id,
      organizationId: id,
    });
    return {
      id: org.id,
      name: org.name,
      plan: org.plan,
      isQa: org.isQa,
      legalName: org.legalName,
      taxIdType: org.taxIdType,
      taxId: org.taxId,
      createdAt: org.createdAt,
      members: members
        .filter((m) => m.user)
        .map((m) => ({
          userId: m.userId,
          name: m.user.name,
          email: m.user.email ?? null,
          role: m.role,
          status: m.status,
          messagingAiEnabled: m.messagingAiEnabled,
        })),
    };
  }

  async listOrgTransactions(
    actorUserId: string,
    id: string,
    params: { page?: string; limit?: string; from?: string; to?: string; q?: string },
  ): Promise<Page<Record<string, unknown>>> {
    await this.getOrgOrThrow(id);
    const page = clampPage(params.page);
    const limit = clampLimit(params.limit);
    const qb = this.transactions
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.account', 'account')
      .where('t.organization_id = :id', { id })
      .andWhere('t.deletedAt IS NULL');
    if (params.from) qb.andWhere('t.occurredAt >= :from', { from: params.from });
    if (params.to) qb.andWhere('t.occurredAt <= :to', { to: params.to });
    if (params.q?.trim()) qb.andWhere('t.description ILIKE :q', { q: `%${params.q.trim()}%` });
    qb.orderBy('t.occurredAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    const [rows, total] = await qb.getManyAndCount();

    await this.audit.record({
      actorUserId,
      action: 'read',
      entityType: 'transaction',
      organizationId: id,
      query: { from: params.from ?? null, to: params.to ?? null, q: params.q ?? null, total },
    });
    return {
      items: rows.map((t) => ({
        id: t.id,
        occurredAt: t.occurredAt,
        amount: t.amount,
        direction: t.direction,
        description: t.description,
        category: t.category?.name ?? null,
        account: t.account?.name ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  async listOrgAccounts(actorUserId: string, id: string): Promise<Record<string, unknown>[]> {
    await this.getOrgOrThrow(id);
    const rows = await this.accounts.find({
      where: { organizationId: id },
      order: { name: 'ASC' },
    });
    await this.audit.record({
      actorUserId,
      action: 'read',
      entityType: 'account',
      organizationId: id,
      query: { total: rows.length },
    });
    return rows.map((a) => ({ id: a.id, name: a.name, isActive: a.isActive }));
  }

  async listOrgCategories(actorUserId: string, id: string): Promise<Record<string, unknown>[]> {
    await this.getOrgOrThrow(id);
    const rows = await this.categories.find({
      where: { organizationId: id },
      order: { name: 'ASC' },
    });
    await this.audit.record({
      actorUserId,
      action: 'read',
      entityType: 'category',
      organizationId: id,
      query: { total: rows.length },
    });
    return rows.map((c) => ({ id: c.id, name: c.name, type: c.type }));
  }

  async patchOrganization(
    actorUserId: string,
    id: string,
    dto: PatchPlatformOrganizationDto,
  ): Promise<Record<string, unknown>> {
    const org = await this.getOrgOrThrow(id);
    const before = {
      name: org.name,
      plan: org.plan,
      isQa: org.isQa,
      legalName: org.legalName,
      taxIdType: org.taxIdType,
      taxId: org.taxId,
    };
    if (dto.name !== undefined) org.name = dto.name.trim().slice(0, 128);
    if (dto.plan !== undefined) org.plan = dto.plan;
    if (dto.isQa !== undefined) org.isQa = dto.isQa;
    if (dto.legalName !== undefined) org.legalName = dto.legalName?.trim() || null;
    if (dto.taxIdType !== undefined) org.taxIdType = dto.taxIdType;
    if (dto.taxId !== undefined) org.taxId = dto.taxId?.trim() || null;
    await this.orgs.save(org);
    const after = {
      name: org.name,
      plan: org.plan,
      isQa: org.isQa,
      legalName: org.legalName,
      taxIdType: org.taxIdType,
      taxId: org.taxId,
    };

    await this.audit.record({
      actorUserId,
      action: 'update',
      entityType: 'organization',
      entityId: id,
      organizationId: id,
      before,
      after,
    });
    return { id: org.id, ...after, createdAt: org.createdAt };
  }

  async createOrganization(
    actorUserId: string,
    dto: CreatePlatformOrganizationDto,
  ): Promise<Record<string, unknown>> {
    if (dto.ownerUserId) {
      const owner = await this.users.findOne({ where: { id: dto.ownerUserId } });
      if (!owner) throw new NotFoundException('Utilizador owner não encontrado');
    }

    const org = this.orgs.create({
      name: dto.name.trim().slice(0, 128),
      plan: dto.plan ?? 'free',
      isQa: dto.isQa ?? false,
      legalName: dto.legalName?.trim() || null,
      taxIdType: dto.taxIdType ?? null,
      taxId: dto.taxId?.trim() || null,
    });
    const saved = await this.orgs.save(org);

    let ownerMembership: { userId: string; role: OrganizationMembershipRole } | null = null;
    if (dto.ownerUserId) {
      const membership = this.memberships.create({
        organizationId: saved.id,
        userId: dto.ownerUserId,
        role: 'owner',
        status: 'active',
      });
      await this.memberships.save(membership);
      ownerMembership = { userId: dto.ownerUserId, role: 'owner' };
    }

    await this.audit.record({
      actorUserId,
      action: 'create',
      entityType: 'organization',
      entityId: saved.id,
      organizationId: saved.id,
      after: {
        id: saved.id,
        name: saved.name,
        plan: saved.plan,
        isQa: saved.isQa,
        ownerMembership,
      },
    });

    return this.getOrganizationDetail(actorUserId, saved.id);
  }

  /** Regista início de impersonation auditada (cliente activa X-Organization-Id em seguida). */
  async startImpersonation(
    actorUserId: string,
    organizationId: string,
  ): Promise<{ organizationId: string; organizationName: string }> {
    const org = await this.getOrgOrThrow(organizationId);
    await this.audit.record({
      actorUserId,
      action: 'impersonate',
      entityType: 'organization',
      entityId: org.id,
      organizationId: org.id,
      after: { id: org.id, name: org.name, plan: org.plan },
    });
    return { organizationId: org.id, organizationName: org.name };
  }

  private async getUserOrThrow(userId: string): Promise<UserEntity> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilizador não encontrado');
    return user;
  }

  private membershipPublic(m: OrganizationMembershipEntity) {
    return {
      userId: m.userId,
      organizationId: m.organizationId,
      role: m.role,
      status: m.status,
      messagingAiEnabled: m.messagingAiEnabled,
    };
  }

  async addMember(
    actorUserId: string,
    organizationId: string,
    dto: CreatePlatformMembershipDto,
  ): Promise<Record<string, unknown>> {
    await this.getOrgOrThrow(organizationId);
    await this.getUserOrThrow(dto.userId);

    const existing = await this.memberships.findOne({
      where: { organizationId, userId: dto.userId },
      withDeleted: true,
    });
    if (existing && !existing.deletedAt) {
      throw new BadRequestException('Utilizador já é membro desta organização');
    }

    let membership: OrganizationMembershipEntity;
    if (existing?.deletedAt) {
      existing.deletedAt = null;
      existing.role = dto.role;
      existing.status = 'active';
      membership = await this.memberships.save(existing);
    } else {
      membership = await this.memberships.save(
        this.memberships.create({
          organizationId,
          userId: dto.userId,
          role: dto.role,
          status: 'active',
        }),
      );
    }

    const row = this.membershipPublic(membership);
    await this.audit.record({
      actorUserId,
      action: 'create',
      entityType: 'organization_membership',
      entityId: membership.id,
      organizationId,
      after: row,
    });
    return row;
  }

  async patchMember(
    actorUserId: string,
    organizationId: string,
    userId: string,
    dto: PatchPlatformMembershipDto,
  ): Promise<Record<string, unknown>> {
    await this.getOrgOrThrow(organizationId);
    const membership = await this.memberships.findOne({
      where: { organizationId, userId },
    });
    if (!membership || membership.deletedAt) {
      throw new NotFoundException('Membership não encontrada');
    }

    const before = this.membershipPublic(membership);
    if (dto.role !== undefined) membership.role = dto.role;
    if (dto.status !== undefined) membership.status = dto.status;
    if (dto.messagingAiEnabled !== undefined) {
      membership.messagingAiEnabled = dto.messagingAiEnabled;
    }
    const saved = await this.memberships.save(membership);
    const after = this.membershipPublic(saved);

    await this.audit.record({
      actorUserId,
      action: 'update',
      entityType: 'organization_membership',
      entityId: saved.id,
      organizationId,
      before,
      after,
    });
    return after;
  }

  async removeMember(
    actorUserId: string,
    organizationId: string,
    userId: string,
  ): Promise<{ removed: true }> {
    await this.getOrgOrThrow(organizationId);
    const membership = await this.memberships.findOne({
      where: { organizationId, userId },
    });
    if (!membership || membership.deletedAt) {
      throw new NotFoundException('Membership não encontrada');
    }

    const before = this.membershipPublic(membership);
    await this.memberships.softRemove(membership);

    await this.audit.record({
      actorUserId,
      action: 'deactivate',
      entityType: 'organization_membership',
      entityId: membership.id,
      organizationId,
      before,
      after: null,
    });
    return { removed: true };
  }

  async listAudit(params: AuditListParams): Promise<Page<PlatformAuditListItem>> {
    const page = clampPage(params.page);
    const limit = clampLimit(params.limit);
    const qb = this.createAuditQueryBuilder(params);
    qb.skip((page - 1) * limit).take(limit);
    const [rows, total] = await qb.getManyAndCount();
    const items = await this.mapAuditRowsToItems(rows);
    return { items, total, page, limit };
  }

  async exportAudit(params: AuditListParams): Promise<PlatformAuditExportResult> {
    const qb = this.createAuditQueryBuilder(params);
    const total = await qb.getCount();
    const rows = await qb.take(AUDIT_EXPORT_MAX).getMany();
    const items = await this.mapAuditRowsToItems(rows);
    return { items, total, exported: items.length, truncated: total > items.length };
  }

  private createAuditQueryBuilder(
    params: AuditListParams,
  ): SelectQueryBuilder<PlatformAuditLogEntity> {
    const qb = this.auditLog
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.actor', 'actor')
      .leftJoin('organizations', 'org', 'org.id = a.organization_id');

    if (params.entityType?.trim()) {
      qb.andWhere('a.entity_type = :et', { et: params.entityType.trim() });
    }
    if (params.actorUserId?.trim()) {
      qb.andWhere('a.actor_user_id = :au', { au: params.actorUserId.trim() });
    }
    if (params.organizationId?.trim()) {
      qb.andWhere('a.organization_id = :oid', { oid: params.organizationId.trim() });
    }
    if (params.action?.trim()) {
      qb.andWhere('a.action = :action', { action: params.action.trim() });
    }
    const from = parseAuditDate(params.from);
    if (from) qb.andWhere('a.created_at >= :from', { from });
    const to = parseAuditDateEnd(params.to);
    if (to) qb.andWhere('a.created_at <= :to', { to });

    const q = params.q?.trim();
    if (q) {
      qb.andWhere(
        `(a.entity_type ILIKE :q
          OR CAST(a.entity_id AS text) ILIKE :q
          OR actor.name ILIKE :q
          OR actor.username ILIKE :q
          OR org.name ILIKE :q)`,
        { q: `%${q}%` },
      );
    }

    // Property path ('a.createdAt'), não o nome de banco ('a.created_at'): o exportAudit usa
    // take() + getMany(), que faz o TypeORM montar a subquery DISTINCT e resolver o ORDER BY por
    // property path. Com o nome de banco a coluna não é encontrada e o TypeORM quebra em
    // column.databaseName (TypeError), devolvendo 500 no endpoint.
    return qb.orderBy('a.createdAt', 'DESC');
  }

  private async mapAuditRowsToItems(
    rows: PlatformAuditLogEntity[],
  ): Promise<PlatformAuditListItem[]> {
    const orgIds = [
      ...new Set(rows.map((r) => r.organizationId).filter((id): id is string => Boolean(id))),
    ];
    const orgNameById = new Map<string, string>();
    if (orgIds.length > 0) {
      const orgs = await this.orgs.find({ where: { id: In(orgIds) } });
      for (const o of orgs) orgNameById.set(o.id, o.name);
    }

    const entityLabels = await this.resolveAuditEntityLabels(rows);

    return rows.map((row) => {
      const actor = row.actor;
      const actorLabel = actor
        ? `${actor.name} (${actor.username})`
        : row.actorUserId
          ? row.actorUserId
          : null;
      const organizationName = (row.organizationId && orgNameById.get(row.organizationId)) ?? null;
      const entityLabel =
        (row.entityId && entityLabels.get(`${row.entityType}:${row.entityId}`)) ??
        inferAuditEntityLabel(row);

      return {
        id: row.id,
        actorUserId: row.actorUserId,
        actorLabel,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        entityLabel,
        organizationId: row.organizationId,
        organizationName,
        before: row.before ?? null,
        after: row.after ?? null,
        query: row.query ?? null,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  private async resolveAuditEntityLabels(
    rows: PlatformAuditLogEntity[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const byType = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!row.entityId) continue;
      const set = byType.get(row.entityType) ?? new Set<string>();
      set.add(row.entityId);
      byType.set(row.entityType, set);
    }

    const orgIds = byType.get('organization');
    if (orgIds?.size) {
      const orgs = await this.orgs.find({ where: { id: In([...orgIds]) } });
      for (const o of orgs) out.set(`organization:${o.id}`, o.name);
    }

    const userIds = byType.get('user');
    if (userIds?.size) {
      const users = await this.users.find({ where: { id: In([...userIds]) } });
      for (const u of users) out.set(`user:${u.id}`, `${u.name} (${u.username})`);
    }

    const membershipIds = byType.get('organization_membership');
    if (membershipIds?.size) {
      const memberships = await this.memberships.find({
        where: { id: In([...membershipIds]) },
        relations: ['user', 'organization'],
      });
      for (const m of memberships) {
        const label = m.user && m.organization ? `${m.user.name} em ${m.organization.name}` : m.id;
        out.set(`organization_membership:${m.id}`, label);
      }
    }

    return out;
  }
}

function parseAuditDate(raw?: string): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseAuditDateEnd(raw?: string): Date | null {
  const d = parseAuditDate(raw);
  if (!d) return null;
  d.setHours(23, 59, 59, 999);
  return d;
}

function inferAuditEntityLabel(row: PlatformAuditLogEntity): string | null {
  const snapshot = row.after ?? row.before;
  if (!snapshot || typeof snapshot !== 'object') return row.entityId;
  if (typeof snapshot.sourceKey === 'string') return snapshot.sourceKey;
  if (typeof snapshot.name === 'string') return snapshot.name;
  if (typeof snapshot.title === 'string') return snapshot.title;
  return row.entityId;
}

function csvCell(value: string | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function jsonCell(value: Record<string, unknown> | null): string {
  return value ? JSON.stringify(value) : '';
}

export function platformAuditItemsToCsv(items: PlatformAuditListItem[]): string {
  const header =
    'id,data,accao,tipo_entidade,entidade_id,entidade,operador_id,operador,org_id,org,antes,depois,parametros';
  const lines = items.map((row) =>
    [
      csvCell(row.id),
      csvCell(row.createdAt),
      csvCell(row.action),
      csvCell(row.entityType),
      csvCell(row.entityId),
      csvCell(row.entityLabel),
      csvCell(row.actorUserId),
      csvCell(row.actorLabel),
      csvCell(row.organizationId),
      csvCell(row.organizationName),
      csvCell(jsonCell(row.before)),
      csvCell(jsonCell(row.after)),
      csvCell(jsonCell(row.query)),
    ].join(','),
  );
  return [header, ...lines].join('\n');
}
