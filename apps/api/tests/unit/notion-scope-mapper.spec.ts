import type { Repository } from 'typeorm';
import type { UserEntity } from '@app/database/entities/user.entity';
import type { OrganizationEntity } from '@app/database/entities/organization.entity';
import {
  loadActiveUserIdsOrdered,
  notionOwnerSelectToOwnerUserId,
  ownerUserIdToNotionOwnerSelect,
  resolveNotionSyncOrganizationId,
} from '@app/modules/notion/notion-scope-mapper';

describe('notion-scope-mapper', () => {
  describe('notionOwnerSelectToOwnerUserId', () => {
    it('maps all to null', () => {
      expect(notionOwnerSelectToOwnerUserId('all', ['a', 'b'])).toBeNull();
      expect(notionOwnerSelectToOwnerUserId(undefined, ['a'])).toBeNull();
    });
    it('maps user1 and user2', () => {
      expect(notionOwnerSelectToOwnerUserId('user1', ['u1', 'u2'])).toBe('u1');
      expect(notionOwnerSelectToOwnerUserId('user2', ['u1', 'u2'])).toBe('u2');
      expect(notionOwnerSelectToOwnerUserId('user2', ['only'])).toBe('only');
    });
  });

  describe('ownerUserIdToNotionOwnerSelect', () => {
    it('maps null to all', () => {
      expect(ownerUserIdToNotionOwnerSelect(null, ['a', 'b'])).toBe('all');
      expect(ownerUserIdToNotionOwnerSelect(undefined, ['a'])).toBe('all');
    });
    it('maps known ids', () => {
      expect(ownerUserIdToNotionOwnerSelect('a', ['a', 'b'])).toBe('user1');
      expect(ownerUserIdToNotionOwnerSelect('b', ['a', 'b'])).toBe('user2');
      expect(ownerUserIdToNotionOwnerSelect('x', ['a', 'b'])).toBe('user1');
    });
    it('falls back to all when no ordered ids', () => {
      expect(ownerUserIdToNotionOwnerSelect('x', [])).toBe('all');
    });
  });

  describe('loadActiveUserIdsOrdered', () => {
    it('returns ordered ids', async () => {
      const usersRepo = {
        find: jest.fn().mockResolvedValue([{ id: 'z' }, { id: 'a' }]),
      } as unknown as Repository<UserEntity>;
      const ids = await loadActiveUserIdsOrdered(usersRepo);
      expect(ids).toEqual(['z', 'a']);
    });
  });

  describe('resolveNotionSyncOrganizationId', () => {
    it('uses single org when count <= 1', async () => {
      const orgRepo = {
        count: jest.fn().mockResolvedValue(1),
        find: jest.fn().mockResolvedValue([{ id: 'org-1' }]),
      } as unknown as Repository<OrganizationEntity>;
      await expect(resolveNotionSyncOrganizationId(orgRepo)).resolves.toBe('org-1');
    });

    it('throws when no organizations', async () => {
      const orgRepo = {
        count: jest.fn().mockResolvedValue(0),
        find: jest.fn().mockResolvedValue([]),
      } as unknown as Repository<OrganizationEntity>;
      await expect(resolveNotionSyncOrganizationId(orgRepo)).rejects.toThrow(
        'Nenhuma organização na base',
      );
    });

    it('requires env when multiple orgs', async () => {
      const orgRepo = {
        count: jest.fn().mockResolvedValue(3),
      } as unknown as Repository<OrganizationEntity>;
      const prev = process.env.NOTION_SYNC_ORGANIZATION_ID;
      delete process.env.NOTION_SYNC_ORGANIZATION_ID;
      await expect(resolveNotionSyncOrganizationId(orgRepo)).rejects.toThrow(
        'NOTION_SYNC_ORGANIZATION_ID',
      );
      process.env.NOTION_SYNC_ORGANIZATION_ID = prev;
    });

    it('resolves org from env when multiple orgs', async () => {
      const orgRepo = {
        count: jest.fn().mockResolvedValue(2),
        findOne: jest.fn().mockResolvedValue({ id: 'env-org' }),
      } as unknown as Repository<OrganizationEntity>;
      const prev = process.env.NOTION_SYNC_ORGANIZATION_ID;
      process.env.NOTION_SYNC_ORGANIZATION_ID = '  env-org  ';
      await expect(resolveNotionSyncOrganizationId(orgRepo)).resolves.toBe('env-org');
      process.env.NOTION_SYNC_ORGANIZATION_ID = prev;
    });

    it('throws when env org missing', async () => {
      const orgRepo = {
        count: jest.fn().mockResolvedValue(2),
        findOne: jest.fn().mockResolvedValue(null),
      } as unknown as Repository<OrganizationEntity>;
      const prev = process.env.NOTION_SYNC_ORGANIZATION_ID;
      process.env.NOTION_SYNC_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000099';
      await expect(resolveNotionSyncOrganizationId(orgRepo)).rejects.toThrow('inválido');
      process.env.NOTION_SYNC_ORGANIZATION_ID = prev;
    });
  });
});
