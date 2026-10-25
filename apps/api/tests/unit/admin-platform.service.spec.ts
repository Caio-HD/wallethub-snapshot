import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { AdminPlatformService, platformAuditItemsToCsv } from '@app/modules/admin/admin-platform.service';
import type { OrganizationEntity } from '@app/database/entities/organization.entity';
import type { OrganizationMembershipEntity } from '@app/database/entities/organization-membership.entity';
import type { UserEntity } from '@app/database/entities/user.entity';
import type { PlatformAuditLogEntity } from '@app/database/entities/platform-audit-log.entity';
import type { PlatformAuditService } from '@app/modules/admin/platform-audit.service';

const makeService = () => {
  const orgs = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ ...x, id: 'org-new', createdAt: new Date() })),
    findOne: jest.fn(),
    find: jest.fn(),
  } as unknown as Repository<OrganizationEntity>;

  const memberships = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ ...x, id: 'mem-1' })),
    findOne: jest.fn(),
    softRemove: jest.fn(),
    find: jest.fn(),
  } as unknown as Repository<OrganizationMembershipEntity>;

  const users = {
    findOne: jest.fn(),
    find: jest.fn(),
  } as unknown as Repository<UserEntity>;

  const auditLog = {
    createQueryBuilder: jest.fn(),
  } as unknown as Repository<PlatformAuditLogEntity>;

  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as PlatformAuditService;

  const service = new AdminPlatformService(
    orgs,
    memberships,
    users,
    {} as never,
    {} as never,
    {} as never,
    auditLog,
    audit,
  );

  return { service, orgs, memberships, users, auditLog, audit };
};

describe('AdminPlatformService (M4)', () => {
  it('createOrganization persiste org e membership owner opcional', async () => {
    const { service, orgs, memberships, users, audit } = makeService();
    jest.mocked(users.findOne).mockResolvedValue({ id: 'u1' } as UserEntity);

    const detailSpy = jest
      .spyOn(service, 'getOrganizationDetail')
      .mockResolvedValue({ id: 'org-new', name: 'Casa' });

    await service.createOrganization('op-1', {
      name: 'Casa',
      ownerUserId: 'u1',
    });

    expect(orgs.save).toHaveBeenCalled();
    expect(memberships.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', role: 'owner', status: 'active' }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entityType: 'organization' }),
    );
    expect(detailSpy).toHaveBeenCalledWith('op-1', 'org-new');
  });

  it('addMember rejeita membership duplicada activa', async () => {
    const { service, orgs, memberships, users } = makeService();
    jest.mocked(orgs.findOne).mockResolvedValue({ id: 'o1' } as OrganizationEntity);
    jest.mocked(users.findOne).mockResolvedValue({ id: 'u1' } as UserEntity);
    jest.mocked(memberships.findOne).mockResolvedValue({
      id: 'm1',
      deletedAt: null,
    } as OrganizationMembershipEntity);

    await expect(
      service.addMember('op-1', 'o1', { userId: 'u1', role: 'member' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removeMember faz soft-remove e audita', async () => {
    const { service, orgs, memberships, audit } = makeService();
    jest.mocked(orgs.findOne).mockResolvedValue({ id: 'o1' } as OrganizationEntity);
    const row = {
      id: 'm1',
      organizationId: 'o1',
      userId: 'u1',
      role: 'member',
      status: 'active',
      messagingAiEnabled: false,
      deletedAt: null,
    } as OrganizationMembershipEntity;
    jest.mocked(memberships.findOne).mockResolvedValue(row);

    const result = await service.removeMember('op-1', 'o1', 'u1');

    expect(memberships.softRemove).toHaveBeenCalledWith(row);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'deactivate', entityType: 'organization_membership' }),
    );
    expect(result).toEqual({ removed: true });
  });
});

describe('AdminPlatformService.listAudit (M3)', () => {
  const makeQb = (rows: PlatformAuditLogEntity[], total = rows.length) => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
    };
    return qb;
  };

  it('enriquece actorLabel e entityLabel', async () => {
    const { service, auditLog, orgs, users } = makeService();
    const createdAt = new Date('2026-06-17T12:00:00Z');
    const row = {
      id: 'log-1',
      actorUserId: 'op-1',
      actor: { id: 'op-1', name: 'Operador', username: 'platform' },
      action: 'update',
      entityType: 'organization',
      entityId: 'org-1',
      organizationId: 'org-1',
      before: { name: 'Antes' },
      after: { name: 'Depois' },
      query: null,
      createdAt,
      updatedAt: createdAt,
    } as unknown as PlatformAuditLogEntity;

    jest.mocked(auditLog.createQueryBuilder).mockReturnValue(makeQb([row]) as never);
    jest.mocked(orgs.find).mockResolvedValue([{ id: 'org-1', name: 'Casa' } as OrganizationEntity]);
    jest.mocked(users.find).mockResolvedValue([]);

    const result = await service.listAudit({ page: '1', limit: '20' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      actorLabel: 'Operador (platform)',
      entityLabel: 'Casa',
      organizationName: 'Casa',
      action: 'update',
    });
    expect(result.items[0].createdAt).toBe(createdAt.toISOString());
  });

  it('aplica filtros entityType e action no query builder', async () => {
    const { service, auditLog } = makeService();
    const qb = makeQb([]);
    jest.mocked(auditLog.createQueryBuilder).mockReturnValue(qb as never);

    await service.listAudit({
      entityType: 'user',
      action: 'create',
      organizationId: 'org-1',
      actorUserId: 'op-1',
      from: '2026-06-01',
      to: '2026-06-17',
      q: 'casa',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('a.entity_type = :et', { et: 'user' });
    expect(qb.andWhere).toHaveBeenCalledWith('a.action = :action', { action: 'create' });
    expect(qb.andWhere).toHaveBeenCalledWith('a.organization_id = :oid', { oid: 'org-1' });
    expect(qb.andWhere).toHaveBeenCalledWith('a.actor_user_id = :au', { au: 'op-1' });
    expect(qb.andWhere).toHaveBeenCalledWith('a.created_at >= :from', expect.any(Object));
    expect(qb.andWhere).toHaveBeenCalledWith('a.created_at <= :to', expect.any(Object));
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), { q: '%casa%' });
  });

  it('startImpersonation regista evento impersonate na trilha', async () => {
    const { service, orgs, audit } = makeService();
    jest.mocked(orgs.findOne).mockResolvedValue({
      id: 'o1',
      name: 'Casa',
      plan: 'free',
    } as OrganizationEntity);

    const result = await service.startImpersonation('op-1', 'o1');

    expect(result).toEqual({ organizationId: 'o1', organizationName: 'Casa' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'op-1',
        action: 'impersonate',
        entityType: 'organization',
        entityId: 'o1',
        organizationId: 'o1',
      }),
    );
  });
});

describe('AdminPlatformService.exportAudit (M3)', () => {
  const makeQb = (rows: PlatformAuditLogEntity[], total = rows.length) => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(total),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
  });

  it('exporta até o limite e sinaliza truncated', async () => {
    const { service, auditLog, orgs, users } = makeService();
    const createdAt = new Date('2026-06-17T12:00:00Z');
    const row = {
      id: 'log-1',
      actorUserId: 'op-1',
      actor: { id: 'op-1', name: 'Operador', username: 'platform' },
      action: 'update',
      entityType: 'organization',
      entityId: 'org-1',
      organizationId: 'org-1',
      before: { name: 'Antes' },
      after: { name: 'Depois' },
      query: null,
      createdAt,
      updatedAt: createdAt,
    } as unknown as PlatformAuditLogEntity;

    const qb = makeQb([row], 9999);
    jest.mocked(auditLog.createQueryBuilder).mockReturnValue(qb as never);
    jest.mocked(orgs.find).mockResolvedValue([{ id: 'org-1', name: 'Casa' } as OrganizationEntity]);
    jest.mocked(users.find).mockResolvedValue([]);

    const result = await service.exportAudit({ entityType: 'organization' });

    expect(qb.take).toHaveBeenCalledWith(5000);
    expect(result.truncated).toBe(true);
    expect(result.items[0].entityLabel).toBe('Casa');
  });
});

describe('platformAuditItemsToCsv', () => {
  it('serializa cabeçalho e linhas com escape CSV', () => {
    const csv = platformAuditItemsToCsv([
      {
        id: 'log-1',
        actorUserId: 'op-1',
        actorLabel: 'Operador (platform)',
        action: 'update',
        entityType: 'organization',
        entityId: 'org-1',
        entityLabel: 'Casa, Lda',
        organizationId: 'org-1',
        organizationName: 'Casa',
        before: { name: 'Antes' },
        after: { name: 'Depois' },
        query: null,
        createdAt: '2026-06-17T12:00:00.000Z',
      },
    ]);

    expect(csv.split('\n')[0]).toContain('id,data,accao');
    expect(csv).toContain('"Casa, Lda"');
  });
});
