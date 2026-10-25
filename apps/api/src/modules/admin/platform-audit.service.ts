import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Counter } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import {
  PlatformAuditLogEntity,
  type PlatformAuditAction,
} from '../../database/entities/platform-audit-log.entity.js';

export interface PlatformAuditRecord {
  actorUserId: string;
  action: PlatformAuditAction;
  entityType: string;
  entityId?: string | null;
  organizationId?: string | null;
  /** Full state (may contain PII) — DB row only, never the log sink. */
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** Filters/count for read/list endpoints (no row PII). */
  query?: Record<string, unknown> | null;
}

/** Metadata for an audited mutation; before/after are captured by `auditedMutation`. */
export interface PlatformMutationMeta {
  actorUserId: string;
  action: Extract<PlatformAuditAction, 'create' | 'update' | 'deactivate'>;
  entityType: string;
  /** May be a function so a created entity's id (unknown until after the write) is resolved post-mutate. */
  entityId?: string | ((mutated: unknown) => string | null) | null;
  organizationId?: string | null;
}

export const AUDIT_PERSIST_FAILURES_METRIC = 'platform_audit_persist_failures_total';

/**
 * Single write path for the platform-operator audit trail.
 *
 * - DB row (`platform_audit_log`): full before/after for investigation. ADVISORY — the operator
 *   has production DB access and could alter it.
 * - Off-host log sink: PII-free metadata (who/what/when/which-entity) only, per LGPD rule 9. This
 *   is the tamper-resistant control and survives even if the DB row is edited.
 *
 * Best-effort + observable: an audit failure is logged at error level and counted via
 * `platform_audit_persist_failures_total` (alertable), but never breaks the audited operation
 * (a failed insert must not, e.g., make a read 500). A durable off-host sink is milestone M1b.
 */
@Injectable()
export class PlatformAuditService {
  private readonly logger = new Logger('PlatformAudit');

  constructor(
    @InjectRepository(PlatformAuditLogEntity)
    private readonly repo: Repository<PlatformAuditLogEntity>,
    @InjectMetric(AUDIT_PERSIST_FAILURES_METRIC)
    private readonly persistFailures: Counter<string>,
  ) {}

  async record(entry: PlatformAuditRecord): Promise<void> {
    // Tamper-resistant metadata mirror first, so it lands even if the DB write fails.
    this.logger.log({
      audit: 'platform',
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      organizationId: entry.organizationId ?? null,
    });

    try {
      await this.repo.save(
        this.repo.create({
          actorUserId: entry.actorUserId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          organizationId: entry.organizationId ?? null,
          before: entry.before ?? null,
          after: entry.after ?? null,
          query: entry.query ?? null,
        }),
      );
    } catch (err) {
      this.logger.error({
        audit: 'platform',
        event: 'persist_failed',
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        error: err instanceof Error ? err.message : String(err),
      });
      // Make the silent loss of an advisory row alertable. The metric must never mask the failure.
      try {
        this.persistFailures.inc({ action: entry.action, entity_type: entry.entityType });
      } catch (metricErr) {
        // best-effort: a metrics backend hiccup must not mask the original persist failure.
        void metricErr;
      }
    }
  }

  /**
   * Wrap a mutation so before/after capture cannot be forgotten:
   *   loadBefore → mutate → projectAfter → record.
   * Returns the projected `after`, so handlers can `return this.audit.auditedMutation(...)`.
   *
   * `record` is best-effort (see class doc). If `projectAfter` throws *after* the mutation has
   * already persisted, we still record that the mutation happened (with `after: null` + a
   * `projectionError` flag) before propagating the error.
   */
  async auditedMutation<TAfter extends Record<string, unknown>>(
    meta: PlatformMutationMeta,
    loadBefore: () => Promise<Record<string, unknown> | null>,
    mutate: () => Promise<unknown>,
    projectAfter: (mutated: unknown) => Promise<TAfter> | TAfter,
  ): Promise<TAfter> {
    const before = await loadBefore();
    const mutated = await mutate();

    const entityId =
      typeof meta.entityId === 'function' ? meta.entityId(mutated) : (meta.entityId ?? null);

    let after: TAfter;
    try {
      after = await projectAfter(mutated);
    } catch (err) {
      await this.record({
        actorUserId: meta.actorUserId,
        action: meta.action,
        entityType: meta.entityType,
        entityId,
        organizationId: meta.organizationId ?? null,
        before,
        after: null,
        query: { projectionError: true },
      });
      throw err;
    }

    await this.record({
      actorUserId: meta.actorUserId,
      action: meta.action,
      entityType: meta.entityType,
      entityId,
      organizationId: meta.organizationId ?? null,
      before,
      after,
    });

    return after;
  }
}
