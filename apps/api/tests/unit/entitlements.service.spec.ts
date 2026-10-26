import { ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { EntitlementsService } from '@app/modules/plan-entitlements/entitlements.service';
import { PlanCapability } from '@app/modules/plan-entitlements/plan-capabilities';
import type { OrganizationUsageCounterEntity } from '@app/database/entities/organization-usage-counter.entity';
import type { OrganizationMembershipEntity } from '@app/database/entities/organization-membership.entity';

const mkMembershipRepo = () =>
  ({
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  }) as unknown as Repository<OrganizationMembershipEntity>;

describe('EntitlementsService', () => {
  const mkRepo = (row: Partial<OrganizationUsageCounterEntity> | null) => {
    const findOne = jest.fn().mockResolvedValue(row);
    const create = jest.fn((x: Partial<OrganizationUsageCounterEntity>) => ({ ...x, id: 'new' }));
    const save = jest.fn(async (x: OrganizationUsageCounterEntity) => x);
    return { findOne, create, save } as unknown as Repository<OrganizationUsageCounterEntity>;
  };

  it('assertCapability throws for free on pro feature', () => {
    const service = new EntitlementsService(
      mkRepo(null) as Repository<OrganizationUsageCounterEntity>,
      mkMembershipRepo(),
    );
    expect(() => service.assertCapability('free', PlanCapability.webStatementImport)).toThrow(
      ForbiddenException,
    );
    expect(() => service.assertCapability('free', PlanCapability.webStatementImport)).toThrow(/Pro/);
  });

  it('assertCapability allows pro', () => {
    const service = new EntitlementsService(
      mkRepo(null) as Repository<OrganizationUsageCounterEntity>,
      mkMembershipRepo(),
    );
    expect(() => service.assertCapability('pro', PlanCapability.webStatementImport)).not.toThrow();
  });

  it('currentPeriodYyyymm returns UTC yyyy-MM', () => {
    const service = new EntitlementsService(
      mkRepo(null) as Repository<OrganizationUsageCounterEntity>,
      mkMembershipRepo(),
    );
    expect(service.currentPeriodYyyymm()).toMatch(/^\d{4}-\d{2}$/);
  });

  it('assertAiMessagingAssistantAllowed blocks free', async () => {
    const service = new EntitlementsService(
      mkRepo(null) as Repository<OrganizationUsageCounterEntity>,
      mkMembershipRepo(),
    );
    await expect(service.assertAiMessagingAssistantAllowed('org', 'free')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('assertAiMessagingAssistantAllowed blocks when over limit', async () => {
    const usageRepository = mkRepo({
      organizationId: 'org',
      periodYyyymm: '2099-01',
      aiMessagingAssistantMessages: 50,
      statementImports: 0,
    }) as Repository<OrganizationUsageCounterEntity>;
    jest.spyOn(EntitlementsService.prototype, 'currentPeriodYyyymm').mockReturnValue('2099-01');
    const service = new EntitlementsService(usageRepository, mkMembershipRepo());
    await expect(service.assertAiMessagingAssistantAllowed('org', 'pro')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    jest.restoreAllMocks();
  });

  it('assertAiMessagingAssistantAllowed passes under limit', async () => {
    const usageRepository = mkRepo({
      organizationId: 'org',
      periodYyyymm: '2099-02',
      aiMessagingAssistantMessages: 10,
      statementImports: 0,
    }) as Repository<OrganizationUsageCounterEntity>;
    jest.spyOn(EntitlementsService.prototype, 'currentPeriodYyyymm').mockReturnValue('2099-02');
    const service = new EntitlementsService(usageRepository, mkMembershipRepo());
    await expect(service.assertAiMessagingAssistantAllowed('org', 'pro')).resolves.toBeUndefined();
    jest.restoreAllMocks();
  });

  it('incrementAiMessagingAssistantCount creates row when missing', async () => {
    const findOne = jest.fn().mockResolvedValueOnce(null);
    const create = jest.fn((x: unknown) => x);
    const save = jest.fn(async (x: OrganizationUsageCounterEntity) => x);
    const usageRepository = { findOne, create, save } as unknown as Repository<OrganizationUsageCounterEntity>;
    jest.spyOn(EntitlementsService.prototype, 'currentPeriodYyyymm').mockReturnValue('2099-03');
    const service = new EntitlementsService(usageRepository, mkMembershipRepo());
    findOne.mockResolvedValueOnce({
      organizationId: 'o',
      periodYyyymm: '2099-03',
      aiMessagingAssistantMessages: 0,
      statementImports: 0,
    });
    await service.incrementAiMessagingAssistantCount('o');
    expect(save).toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('incrementStatementImportCount increments', async () => {
    const row = {
      organizationId: 'o',
      periodYyyymm: '2099-04',
      aiMessagingAssistantMessages: 0,
      statementImports: 2,
    };
    const findOne = jest.fn().mockResolvedValue(row);
    const save = jest.fn(async (x: OrganizationUsageCounterEntity) => x);
    const usageRepository = {
      findOne,
      create: jest.fn(),
      save,
    } as unknown as Repository<OrganizationUsageCounterEntity>;
    jest.spyOn(EntitlementsService.prototype, 'currentPeriodYyyymm').mockReturnValue('2099-04');
    const service = new EntitlementsService(usageRepository, mkMembershipRepo());
    await service.incrementStatementImportCount('o');
    expect(row.statementImports).toBe(3);
    expect(save).toHaveBeenCalledWith(row);
    jest.restoreAllMocks();
  });
});
