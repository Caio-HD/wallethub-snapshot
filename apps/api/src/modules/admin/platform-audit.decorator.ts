import { SetMetadata } from '@nestjs/common';
import type { PlatformAuditAction } from '../../database/entities/platform-audit-log.entity.js';

/**
 * Build-time audit-coverage contract for the platform-operator surface.
 *
 * Every mutating handler (`POST`/`PATCH`/`PUT`/`DELETE`) behind the operator guards
 * (`ElevatedAccessGuard` / `RolesGuard('super_admin')`) MUST carry either `@PlatformAudit(...)`
 * or `@AuditExempt(...)`. The coverage guard-rail test (tests/unit/platform-audit-coverage.spec.ts)
 * fails the build otherwise. The marker is the *contract*; the actual write is
 * `PlatformAuditService.auditedMutation` / `.record`.
 */
export const PLATFORM_AUDIT_KEY = 'platform:audit';
export const AUDIT_EXEMPT_KEY = 'platform:audit-exempt';

export interface PlatformAuditMarker {
  action: PlatformAuditAction;
  entityType: string;
}

/** Marks a handler as audited. Pairs with a `record()`/`auditedMutation()` call in the body. */
export const PlatformAudit = (meta: PlatformAuditMarker) => SetMetadata(PLATFORM_AUDIT_KEY, meta);

export interface AuditExemptMarker {
  /** Why this operator-surface mutation is intentionally not audited (e.g. server-to-server token). */
  reason: string;
}

/** Explicitly exempts a handler from the audit-coverage requirement. The reason travels with the code. */
export const AuditExempt = (meta: AuditExemptMarker) => SetMetadata(AUDIT_EXEMPT_KEY, meta);
