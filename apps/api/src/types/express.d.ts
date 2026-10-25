import type { ActiveOrganizationContext } from '../common/types/active-organization';

declare global {
  namespace Express {
    interface Request {
      activeOrganization?: ActiveOrganizationContext;
    }
  }
}

export {};
