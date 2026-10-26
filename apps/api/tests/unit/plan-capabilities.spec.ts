import {
  PlanCapability,
  aiMessagingAssistantMonthlyLimit,
  messagingAiMemberSeatLimit,
  minPlanForCapability,
  organizationPlanMeets,
} from '@app/modules/plan-entitlements/plan-capabilities';

describe('plan-capabilities', () => {
  it('organizationPlanMeets reflects min plan per capability', () => {
    expect(organizationPlanMeets('free', PlanCapability.webStatementImport)).toBe(false);
    expect(organizationPlanMeets('pro', PlanCapability.webStatementImport)).toBe(true);
    expect(organizationPlanMeets('plus', PlanCapability.messagingAiInsights)).toBe(true);
  });

  it('exports consistent minPlanForCapability', () => {
    expect(minPlanForCapability[PlanCapability.webStatementImport]).toBe('pro');
    expect(minPlanForCapability[PlanCapability.whatsappStatementImport]).toBe('pro');
    expect(aiMessagingAssistantMonthlyLimit.free).toBe(0);
    expect(aiMessagingAssistantMonthlyLimit.pro).toBe(50);
    expect(aiMessagingAssistantMonthlyLimit.plus).toBe(100_000);
  });

  it('exports messagingAiMemberSeatLimit', () => {
    expect(messagingAiMemberSeatLimit.free).toBe(0);
    expect(messagingAiMemberSeatLimit.pro).toBe(2);
    expect(messagingAiMemberSeatLimit.plus).toBe(10_000);
  });
});
