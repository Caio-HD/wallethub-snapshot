import { Column, Entity, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { TransactionEntity } from './transaction.entity.js';
import { UserEntity } from './user.entity.js';

@Entity({ name: 'transaction_audit' })
export class TransactionAuditEntity extends BaseEntity {
  @ManyToOne(() => TransactionEntity, (transaction) => transaction.auditLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transaction_id' })
  transaction!: Relation<TransactionEntity>;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'changed_by' })
  changedBy?: Relation<UserEntity>;

  @Column({ name: 'changed_at', type: 'timestamp' })
  changedAt!: Date;

  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues?: Record<string, any>;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues?: Record<string, any>;

  @Column({ nullable: true })
  reason?: string;

  /** True when written by a super_admin acting under cross-tenant impersonation. */
  @Column({ name: 'under_impersonation', default: false })
  underImpersonation!: boolean;
}
