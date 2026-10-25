import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity.js';
import { OrganizationEntity } from '../../database/entities/organization.entity.js';

export async function loadActiveUserIdsOrdered(
  usersRepo: Repository<UserEntity>,
): Promise<string[]> {
  const users = await usersRepo.find({
    where: { isActive: true },
    order: { createdAt: 'ASC' },
    select: ['id'],
  });
  return users.map((u) => u.id);
}

/** Notion select all | user1 | user2 → titular UUID (null = partilhado). */
export function notionOwnerSelectToOwnerUserId(
  name: string | undefined,
  orderedIds: string[],
): string | null {
  if (!name || name === 'all') return null;
  if (name === 'user1') return orderedIds[0] ?? null;
  if (name === 'user2') return orderedIds[1] ?? orderedIds[0] ?? null;
  return null;
}

export function ownerUserIdToNotionOwnerSelect(
  ownerUserId: string | null | undefined,
  orderedIds: string[],
): 'all' | 'user1' | 'user2' {
  if (ownerUserId == null) return 'all';
  if (orderedIds[0] === ownerUserId) return 'user1';
  if (orderedIds[1] === ownerUserId) return 'user2';
  return orderedIds[0] ? 'user1' : 'all';
}

/** Organização alvo do sync Notion (mono-org ou `NOTION_SYNC_ORGANIZATION_ID`). */
export async function resolveNotionSyncOrganizationId(
  orgRepo: Repository<OrganizationEntity>,
): Promise<string> {
  const count = await orgRepo.count();
  if (count === 0) {
    throw new Error('Nenhuma organização na base');
  }
  if (count <= 1) {
    const rows = await orgRepo.find({ take: 1, select: ['id'] });
    return rows[0].id;
  }
  const raw = process.env.NOTION_SYNC_ORGANIZATION_ID?.trim();
  if (!raw) {
    throw new Error('NOTION_SYNC_ORGANIZATION_ID');
  }
  const one = await orgRepo.findOne({ where: { id: raw } });
  if (!one) {
    throw new Error('Identificador de organização inválido');
  }
  return raw;
}
