import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { OrganizationsService } from '@app/modules/organizations/organizations.service';
import type { OrganizationMembershipEntity } from '@app/database/entities/organization-membership.entity';
import type { OrganizationEntity } from '@app/database/entities/organization.entity';
import type { UserEntity } from '@app/database/entities/user.entity';
import type { EntitlementsService } from '@app/modules/plan-entitlements/entitlements.service';

const mkMembership = (
  organizationId: string,
  userId: string,
  orgName: string,
  plan: 'free' | 'pro' | 'plus' = 'pro',
  deleted = false,
  orgDeleted = false,
) =>
  ({
    organizationId,
    userId,
    status: 'active',
    deletedAt: deleted ? new Date() : null,
    organization: {
      id: organizationId,
      name: orgName,
      plan,
      deletedAt: orgDeleted ? new Date() : null,
    },
  }) as unknown as OrganizationMembershipEntity;

describe('OrganizationsService', () => {
  const repo = (rows: OrganizationMembershipEntity[]) =>
    ({
      find: jest.fn().mockImplementation(({ order: _order }) => Promise.resolve(rows)),
      findOne: jest.fn(),
      save: jest.fn(),
      manager: {},
    }) as unknown as Repository<OrganizationMembershipEntity>;

  const usersRepo = () =>
    ({ findOne: jest.fn() }) as unknown as Repository<UserEntity>;

  // Org repo used by the super_admin impersonation bypass; defaults to "no orgs".
  const orgsRepo = (rows: Partial<OrganizationEntity>[] = []) =>
    ({
      find: jest.fn().mockResolvedValue(rows),
      findOne: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(rows.find((o) => o.id === where.id) ?? null),
        ),
    }) as unknown as Repository<OrganizationEntity>;

  const entitlements = () =>
    ({
      assertCanEnableMessagingAiMemberSeat: jest.fn().mockResolvedValue(undefined),
    }) as unknown as EntitlementsService;

  const svc = (
    membershipsRepository: Repository<OrganizationMembershipEntity>,
    organizationsRepository: Repository<OrganizationEntity> = orgsRepo(),
  ) =>
    new OrganizationsService(
      membershipsRepository,
      usersRepo(),
      organizationsRepository,
      entitlements(),
    );

  it('listForUser returns active orgs sorted by name', async () => {
    const service = svc(
      repo([
        mkMembership('id-b', 'u1', 'Bravo', 'free'),
        mkMembership('id-a', 'u1', 'Alpha', 'plus'),
      ]) as Repository<OrganizationMembershipEntity>,
    );
    const list = await service.listForUser('u1');
    expect(list).toHaveLength(2);
    expect(new Set(list.map((o) => o.id))).toEqual(new Set(['id-a', 'id-b']));
    expect(list.map((o) => o.name).sort()).toEqual(['Alpha', 'Bravo']);
  });

  it('listForUser filters deleted membership and org', async () => {
    const service = svc(
      repo([
        mkMembership('x', 'u1', 'X', 'pro', true),
        mkMembership('y', 'u1', 'Y', 'pro', false, true),
        mkMembership('z', 'u1', 'Z', 'pro'),
      ]),
    );
    const list = await service.listForUser('u1');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('z');
  });

  it('resolveActiveOrganization throws when no orgs', async () => {
    const service = svc(repo([]));
    await expect(service.resolveActiveOrganization('u1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resolveActiveOrganization returns single org', async () => {
    const service = svc(repo([mkMembership('only', 'u1', 'Only')]));
    await expect(service.resolveActiveOrganization('u1')).resolves.toEqual({
      id: 'only',
      plan: 'pro',
    });
  });

  it('resolveActiveOrganization uses header when valid', async () => {
    const service = svc(repo([mkMembership('a', 'u1', 'A'), mkMembership('b', 'u1', 'B')]));
    await expect(service.resolveActiveOrganization('u1', 'b')).resolves.toEqual({ id: 'b', plan: 'pro' });
  });

  it('resolveActiveOrganization rejects invalid header', async () => {
    const service = svc(repo([mkMembership('a', 'u1', 'A'), mkMembership('b', 'u1', 'B')]));
    await expect(service.resolveActiveOrganization('u1', 'nope')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('resolveActiveOrganization requires header for multiple orgs', async () => {
    const service = svc(repo([mkMembership('a', 'u1', 'A'), mkMembership('b', 'u1', 'B')]));
    await expect(service.resolveActiveOrganization('u1', undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('listForUser (elevated) returns ALL orgs without membership', async () => {
    const service = svc(
      repo([]), // no memberships
      orgsRepo([
        { id: 'o1', name: 'Org One', plan: 'pro' },
        { id: 'o2', name: 'Org Two', plan: 'free' },
      ]),
    );
    const list = await service.listForUser('platform-user', { elevated: true });
    expect(new Set(list.map((o) => o.id))).toEqual(new Set(['o1', 'o2']));
  });

  it('resolveActiveOrganization (elevated) impersonates any org by header without membership', async () => {
    const service = svc(repo([]), orgsRepo([{ id: 'o9', name: 'Audited', plan: 'plus' }]));
    await expect(
      service.resolveActiveOrganization('platform-user', 'o9', { elevated: true }),
    ).resolves.toEqual({ id: 'o9', plan: 'plus', impersonated: true });
  });

  it('resolveActiveOrganization (elevated) requires a header (clean error, never org-less)', async () => {
    const service = svc(repo([]), orgsRepo([{ id: 'o9', name: 'Audited', plan: 'plus' }]));
    await expect(
      service.resolveActiveOrganization('platform-user', undefined, { elevated: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolveActiveOrganization (elevated) 404s on a non-existent org', async () => {
    const service = svc(repo([]), orgsRepo([]));
    await expect(
      service.resolveActiveOrganization('platform-user', 'ghost', { elevated: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getMemberUserIdsOrdered returns user ids', async () => {
    const membershipsRepository = {
      find: jest
        .fn()
        .mockResolvedValue([
          { userId: 'u1', deletedAt: null },
          { userId: 'u2', deletedAt: new Date() },
          { userId: 'u3', deletedAt: null },
        ]),
    } as unknown as Repository<OrganizationMembershipEntity>;
    const service = svc(membershipsRepository);
    const ids = await service.getMemberUserIdsOrdered('org');
    expect(ids).toEqual(['u1', 'u3']);
  });

  it('getOrganizationIfMember returns org or null', async () => {
    const membershipsRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({
          organization: { id: 'o1', deletedAt: null },
          deletedAt: null,
        })
        .mockResolvedValueOnce(null),
    } as unknown as Repository<OrganizationMembershipEntity>;
    const service = svc(membershipsRepository);
    await expect(service.getOrganizationIfMember('u', 'o1')).resolves.toMatchObject({ id: 'o1' });
    await expect(service.getOrganizationIfMember('u', 'o2')).resolves.toBeNull();
  });
});
