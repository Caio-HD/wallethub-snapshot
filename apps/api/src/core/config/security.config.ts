import { registerAs } from '@nestjs/config';

export const securityConfig = registerAs('security', () => ({
  /**
   * Kill-switch for super_admin elevated power (cross-tenant impersonation + platform console).
   * Default ON. Set SUPER_ADMIN_BYPASS_ENABLED=false for instant containment (env change +
   * container restart, no rebuild/redeploy) — super_admin then degrades to normal-user behavior.
   */
  superAdminBypassEnabled: (process.env.SUPER_ADMIN_BYPASS_ENABLED ?? 'true') !== 'false',
}));
