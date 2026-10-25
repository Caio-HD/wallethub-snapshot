import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Durable tenant-isolation invariant (PR1a).
 *
 * Background: WalletHub's multi-tenant isolation relies on `ActiveOrganizationGuard` scoping
 * org data by the active organization. Every new user defaults to the global role 'admin', so
 * `@Roles('admin')` effectively means "any authenticated user". An org-scoped controller that
 * forgets `ActiveOrganizationGuard` (as `dashboard` did) leaks data across tenants.
 *
 * This test forces a CONSCIOUS classification of every controller. It fails when:
 *   - a NEW controller is added that is not classified below, or
 *   - a controller drops the guard token its category requires (e.g. dashboard losing
 *     ActiveOrganizationGuard, or an admin/* controller dropping @Roles('super_admin')).
 *
 * It is a file-level tripwire, not a per-route proof: a controller "passes" if its source
 * references the required guard at all. The goal is to make skipping the guard impossible to do
 * silently, and to keep an explicit, reviewed record of the remaining known-debt surface.
 */

const CONTROLLERS_ROOT = join(__dirname, '..', '..', 'src', 'modules');

// Org-scoped: must scope tenant data by the active organization.
const ORG_SCOPED = new Set([
  'accounts/accounts.controller.ts',
  'ai/ai.controller.ts',
  'alerts/alerts.controller.ts',
  'budgets/budgets.controller.ts',
  'categories/categories.controller.ts',
  'dashboard/dashboard.controller.ts',
  'debts/debts.controller.ts',
  'investments/investments.controller.ts',
  'organizations/organizations.controller.ts',
  'reminders/reminders.controller.ts',
  'statement-import/statement-import.controller.ts',
  'transactions/transactions.controller.ts',
  'users/users.controller.ts',
  'whatsapp/organization-whatsapp.controller.ts',
]);

// Elevated/platform: cross-org by nature; restricted to the platform operator or a service token.
const ELEVATED = new Set([
  'admin/admin-platform.controller.ts',
  'admin/admin-ai.controller.ts',
  'admin/admin-integrations.controller.ts',
  'admin/admin-rag.controller.ts',
  'admin/admin-users.controller.ts',
  'admin/qa-admin.controller.ts',
  'telegram/telegram.controller.ts',
  'whatsapp/whatsapp.controller.ts', // public webhook + super_admin status/config/AI-provider
  'backup/backup.controller.ts', // service-to-service: AdminTokenGuard (WALLETHUB_ADMIN_TOKEN)
  // service-to-service: ConnectorTokenGuard (WALLETHUB_CONNECTOR_TOKEN) + allowlist de org no body
  'integrations/zenrick/zenrick-ingest.controller.ts',
  // service-to-service: ConnectorTokenGuard + allowlist de org no query (reports read-only)
  'integrations/zenrick/zenrick-reports.controller.ts',
]);

// Public or self-scoped (by the caller's own user id): no cross-tenant surface.
const PUBLIC_OR_SELF = new Set([
  'banks/banks.controller.ts', // catálogo COMPE read-only (JWT, sem dado de org)
  'auth/auth.controller.ts',
  'health/health.controller.ts',
  'root/root.controller.ts',
  'attachments/attachments.controller.ts', // scoped by user.id ownership
  'rag/user-rag.controller.ts', // /users/me/rag — caller's own docs
  'notion/notion.controller.ts', // only public Meta webhooks; status/sync moved to admin-integrations
]);

/**
 * KNOWN DEBT: controllers still `@Roles('admin')` (== any authenticated user) with cross-org/
 * platform reach. **Now empty** — every such controller has been given a conscious classification:
 * rag/notion writes moved under admin/* (super_admin), whatsapp status/config → super_admin (public
 * webhook kept), backup → AdminTokenGuard (service token). Keep this empty; adding to it requires
 * explicit review and a tracking note in NexusCore.
 */
const KNOWN_DEBT = new Set<string>([]);

function listControllers(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) {
      out.push(...listControllers(full, rel));
    } else if (entry.endsWith('.controller.ts')) {
      out.push(rel);
    }
  }
  return out;
}

describe('tenant isolation invariant (controllers)', () => {
  const controllers = listControllers(CONTROLLERS_ROOT);

  it('finds a non-trivial set of controllers', () => {
    expect(controllers.length).toBeGreaterThan(20);
  });

  it('every controller is consciously classified (a new controller must be added to a set)', () => {
    const classified = new Set([...ORG_SCOPED, ...ELEVATED, ...PUBLIC_OR_SELF, ...KNOWN_DEBT]);
    const unclassified = controllers.filter((c) => !classified.has(c));
    expect(unclassified).toEqual([]);
  });

  it('classification sets reference only real controllers (no stale entries)', () => {
    const actual = new Set(controllers);
    const all = [...ORG_SCOPED, ...ELEVATED, ...PUBLIC_OR_SELF, ...KNOWN_DEBT];
    expect(all.filter((c) => !actual.has(c))).toEqual([]);
  });

  it('org-scoped controllers reference ActiveOrganizationGuard', () => {
    for (const rel of ORG_SCOPED) {
      const src = readFileSync(join(CONTROLLERS_ROOT, rel), 'utf8');
      expect([rel, src.includes('ActiveOrganizationGuard')]).toEqual([rel, true]);
    }
  });

  it('elevated controllers require super_admin or a service token (never plain @Roles("admin"))', () => {
    for (const rel of ELEVATED) {
      const src = readFileSync(join(CONTROLLERS_ROOT, rel), 'utf8');
      const elevated =
        src.includes("@Roles('super_admin')") ||
        src.includes('AdminTokenGuard') ||
        src.includes('ConnectorTokenGuard') ||
        src.includes('ElevatedAccessGuard');
      expect([rel, elevated]).toEqual([rel, true]);
    }
  });
});
