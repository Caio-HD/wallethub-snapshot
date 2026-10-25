import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';

export type PlatformAuditAction = 'create' | 'update' | 'deactivate' | 'impersonate' | 'read';

/**
 * Append-only trail of platform-operator (super_admin) actions: console mutations, impersonation
 * entry, and cross-tenant reads. The operator has DB access, so the in-DB row is advisory; the
 * tamper-resistant control is the PII-free metadata mirror emitted by PlatformAuditService to the
 * off-host log sink.
 */
@Entity({ name: 'platform_audit_log' })
@Index('IDX_platform_audit_entity', ['entityType', 'entityId'])
@Index('IDX_platform_audit_actor_created', ['actorUserId', 'createdAt'])
export class PlatformAuditLogEntity extends BaseEntity {
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_user_id' })
  actor?: Relation<UserEntity> | null;

  @Column({ type: 'varchar', length: 32 })
  action!: PlatformAuditAction;

  @Column({ name: 'entity_type', type: 'varchar', length: 64 })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId!: string | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  before?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after?: Record<string, unknown> | null;

  /** For list/read endpoints: the filters/count, not row PII. */
  @Column({ type: 'jsonb', nullable: true })
  query?: Record<string, unknown> | null;
}
