import type { OrganizationPlan } from '../../database/entities/organization.entity';

export type ActiveOrganizationContext = {
  id: string;
  plan: OrganizationPlan;
  /**
   * True when a super_admin resolved this org via the cross-tenant bypass (no membership).
   * Propagated to audit write paths so impersonated actions are distinguishable.
   */
  impersonated?: boolean;
};
