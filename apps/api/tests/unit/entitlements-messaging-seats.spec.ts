import { ForbiddenException } from '@nestjs/common';
import { EntitlementsService } from '@app/modules/plan-entitlements/entitlements.service';
import { OrganizationMembershipEntity } from '@app/database/entities/organization-membership.entity';
import { OrganizationUsageCounterEntity } from '@app/database/entities/organization-usage-counter.entity';

function membership(partial: Partial<OrganizationMembershipEntity>): OrganizationMembershipEntity {
  return {
    id: 'm1',
    organizationId: 'o1',
    userId: 'u1',
    role: 'member',
    status: 'active',
    messagingAiEnabled: false,
    ...partial,
  } as OrganizationMembershipEntity;
}

describe('EntitlementsService messaging AI seats', () => {
  let service: EntitlementsService;
  let usageRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let membershipRepo: {
    findOne: jest.Mock;
    count: jest.Mock;
  };

  beforeEach(() => {
    usageRepo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    membershipRepo = {
      findOne: jest.fn(),
      count: jest.fn(),
    };
    service = new EntitlementsService(
      usageRepo as unknown as import('typeorm').Repository<OrganizationUsageCounterEntity>,
      membershipRepo as unknown as import('typeorm').Repository<OrganizationMembershipEntity>,
    );
  });

  it('assertMessagingAiSeatForMembership allows owner and admin', () => {
    expect(() => service.assertMessagingAiSeatForMembership(membership({ role: 'owner' }))).not.toThrow();
    expect(() => service.assertMessagingAiSeatForMembership(membership({ role: 'admin' }))).not.toThrow();
  });

  it('assertMessagingAiSeatForMembership allows member when flag true', () => {
    expect(() =>
      service.assertMessagingAiSeatForMembership(
        membership({ role: 'member', messagingAiEnabled: true }),
      ),
    ).not.toThrow();
  });

  it('assertMessagingAiSeatForMembership rejects member without flag', () => {
    expect(() =>
      service.assertMessagingAiSeatForMembership(
        membership({ role: 'member', messagingAiEnabled: false }),
      ),
    ).toThrow(ForbiddenException);
  });
});
