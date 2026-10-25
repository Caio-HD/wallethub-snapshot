import type { Repository } from 'typeorm';
import type { Counter } from 'prom-client';
import { PlatformAuditService } from '@app/modules/admin/platform-audit.service';
import { AdminUsersController } from '@app/modules/admin/admin-users.controller';
import { AdminRagController } from '@app/modules/admin/admin-rag.controller';
import { AdminIntegrationsController } from '@app/modules/admin/admin-integrations.controller';
import type { AdminUsersService } from '@app/modules/admin/admin-users.service';
import type { AdminRagService } from '@app/modules/admin/admin-rag.service';
import type { NotionService } from '@app/modules/notion/notion.service';
import type { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '@app/common/decorators/current-user.decorator';
import type { PlatformAuditLogEntity } from '@app/database/entities/platform-audit-log.entity';

/**
 * Per-call-site proof (PR2): every previously-unaudited operator mutation now writes a
 * platform_audit_log row with the right action / entityType / before / after. Uses a real
 * PlatformAuditService over a mocked repo so we inspect the persisted row directly.
 */
describe('operator mutation audit coverage (PR2 call sites)', () => {
  const actor = { id: 'op-1', role: 'super_admin' } as AuthenticatedUser;

  const makeAudit = () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const repo = {
      create: (r: unknown) => r,
      save,
    } as unknown as Repository<PlatformAuditLogEntity>;
    const counter = { inc: jest.fn() } as unknown as Counter<string>;
    return { audit: new PlatformAuditService(repo, counter), save };
  };

  const lastRow = (save: jest.Mock) =>
    save.mock.calls[save.mock.calls.length - 1][0] as {
      action: string;
      entityType: string;
      entityId: string | null;
      before: unknown;
      after: unknown;
      query: unknown;
    };

  it('AdminUsersController.create → action=create, entityType=user, before=null, entityId from new user', async () => {
    const { audit, save } = makeAudit();
    const created = { id: 'u-new' };
    const adminUsers = {
      create: jest.fn().mockResolvedValue(created),
      toPublic: jest.fn().mockResolvedValue({ id: 'u-new', role: 'admin' }),
    } as unknown as AdminUsersService;
    const controller = new AdminUsersController(adminUsers, audit);

    await controller.create(actor, { username: 'x', name: 'X', password: 'password1' } as never);

    const row = lastRow(save);
    expect(row).toMatchObject({
      action: 'create',
      entityType: 'user',
      entityId: 'u-new',
      before: null,
    });
    expect(row.after).toEqual({ id: 'u-new', role: 'admin' });
  });

  it('AdminUsersController.patch → before=pre-state, after=post-state, entityId=id', async () => {
    const { audit, save } = makeAudit();
    const adminUsers = {
      findOne: jest.fn().mockResolvedValue({ id: 'u1' }),
      update: jest.fn().mockResolvedValue({ id: 'u1' }),
      toPublic: jest
        .fn()
        .mockResolvedValueOnce({ id: 'u1', name: 'Old' })
        .mockResolvedValueOnce({ id: 'u1', name: 'New' }),
    } as unknown as AdminUsersService;
    const controller = new AdminUsersController(adminUsers, audit);

    await controller.patch(actor, 'u1', { name: 'New' } as never);

    const row = lastRow(save);
    expect(row).toMatchObject({ action: 'update', entityType: 'user', entityId: 'u1' });
    expect(row.before).toEqual({ id: 'u1', name: 'Old' });
    expect(row.after).toEqual({ id: 'u1', name: 'New' });
  });

  it('AdminRagController.upsert → action=update, entityType=rag_document, before from tryGetBySourceKey', async () => {
    const { audit, save } = makeAudit();
    const adminRag = {
      tryGetBySourceKey: jest
        .fn()
        .mockResolvedValue({ sourceKey: 'k1', title: 'Old', contentHash: 'h' }),
      upsert: jest.fn().mockResolvedValue({ id: 'd1' }),
    } as unknown as AdminRagService;
    const controller = new AdminRagController(adminRag, audit);

    await controller.upsert(actor, { sourceKey: 'k1', title: 'New', body: 'b' } as never);

    const row = lastRow(save);
    expect(row).toMatchObject({ action: 'update', entityType: 'rag_document' });
    expect(row.before).toEqual({ sourceKey: 'k1', title: 'Old', contentHash: 'h' });
    expect(row.after).toMatchObject({ sourceKey: 'k1', title: 'New' });
  });

  it('AdminRagController.remove → action=deactivate, entityType=rag_document', async () => {
    const { audit, save } = makeAudit();
    const adminRag = {
      tryGetBySourceKey: jest.fn().mockResolvedValue(null),
      remove: jest.fn().mockResolvedValue({ deleted: true }),
    } as unknown as AdminRagService;
    const controller = new AdminRagController(adminRag, audit);

    await controller.remove(actor, 'k1');

    expect(lastRow(save)).toMatchObject({ action: 'deactivate', entityType: 'rag_document' });
  });

  it('AdminIntegrationsController.notionSync → records action=update, entityType=notion_sync, query.entityType', async () => {
    const { audit, save } = makeAudit();
    const notion = { isEnabled: jest.fn().mockReturnValue(true) } as unknown as NotionService;
    const config = {} as unknown as ConfigService;
    const controller = new AdminIntegrationsController(
      config,
      notion,
      audit,
      {
        getQueueMetrics: jest.fn(),
      } as never,
      {} as never,
    );

    await controller.notionSync(actor, { entityType: 'transaction' } as never);

    const row = lastRow(save);
    expect(row).toMatchObject({ action: 'update', entityType: 'notion_sync' });
    expect(row.query).toEqual({ entityType: 'transaction' });
  });
});
