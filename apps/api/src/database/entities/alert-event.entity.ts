import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { PgEnumNames } from '../pg-enum-names.js';
import { BaseEntity } from './base.entity.js';
import { OrganizationEntity } from './organization.entity.js';
import { UserEntity } from './user.entity.js';

export type AlertEventType =
  'negative_balance' | 'reminder_due' | 'whatsapp_disconnected' | 'debt_due_soon';

@Entity({ name: 'alert_events' })
@Index(['organizationId', 'createdAt'])
export class AlertEventEntity extends BaseEntity {
  @Column({ name: 'organization_id' })
  @Index()
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Relation<OrganizationEntity>;

  /** Destinatário; null = visível a todos os membros da organização. */
  @Column({ name: 'user_id', nullable: true })
  userId!: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<UserEntity> | null;

  @Column({
    type: 'enum',
    enum: ['negative_balance', 'reminder_due', 'whatsapp_disconnected', 'debt_due_soon'],
    enumName: PgEnumNames.alertEventType,
  })
  type!: AlertEventType;

  @Column({ type: 'varchar', length: 512 })
  title!: string;

  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt!: Date | null;
}
