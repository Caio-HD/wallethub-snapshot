import type { OrganizationPlan } from '../../database/entities/organization.entity';

/** Capacidades comerciais (fonte única para gating Free / Pro / Plus). */
export const PlanCapability = {
  webStatementImport: 'webStatementImport',
  whatsappStatementImport: 'whatsappStatementImport',
  /** IA assistente fora da web (WhatsApp + Telegram); quota mensal partilhada. */
  messagingAiInsights: 'messagingAiInsights',
  /** Instância Evolution dedicada por organização (WhatsApp multi-tenant). */
  whatsappEvolutionInstance: 'whatsappEvolutionInstance',
} as const;

export type PlanCapability = (typeof PlanCapability)[keyof typeof PlanCapability];

const planRank: Record<OrganizationPlan, number> = {
  free: 0,
  pro: 1,
  plus: 2,
};

/** Plano mínimo necessário para cada capacidade. */
export const minPlanForCapability: Record<PlanCapability, OrganizationPlan> = {
  [PlanCapability.webStatementImport]: 'pro',
  [PlanCapability.whatsappStatementImport]: 'pro',
  /** IA assistente (WhatsApp/Telegram): Pro com quota mensal; Plus com quota elevada. */
  [PlanCapability.messagingAiInsights]: 'pro',
  [PlanCapability.whatsappEvolutionInstance]: 'pro',
};

export function organizationPlanMeets(plan: OrganizationPlan, capability: PlanCapability): boolean {
  return planRank[plan] >= planRank[minPlanForCapability[capability]];
}

/** Limite mensal de mensagens IA via WhatsApp ou Telegram (0 = bloqueado). */
export const aiMessagingAssistantMonthlyLimit: Record<OrganizationPlan, number> = {
  free: 0,
  pro: 50,
  plus: 100_000,
};

/**
 * Vagas de IA para membros com role `member` (owner/admin não contabilizam).
 * free: sem IA nos canais; manter 0 para consistência.
 */
export const messagingAiMemberSeatLimit: Record<OrganizationPlan, number> = {
  free: 0,
  pro: 2,
  plus: 10_000,
};
