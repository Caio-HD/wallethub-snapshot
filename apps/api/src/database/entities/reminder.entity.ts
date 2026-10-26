import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { PgEnumNames } from '../pg-enum-names.js';
import { BaseEntity } from './base.entity.js';
import { OrganizationEntity } from './organization.entity.js';
import { UserEntity } from './user.entity.js';

export type ReminderRecurrence = 'none' | 'monthly';

@Entity({ name: 'reminders' })
export class ReminderEntity extends BaseEntity {
  @Column({ name: 'organization_id' })
  @Index()
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Relation<OrganizationEntity>;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<UserEntity>;

  @Column({ type: 'varchar', length: 256 })
  title!: string;

  @Column({ name: 'due_at', type: 'timestamp' })
  dueAt!: Date;

  @Column({
    type: 'enum',
    enum: ['none', 'monthly'],
    enumName: PgEnumNames.reminderRecurrence,
    default: 'none',
  })
  recurrence!: ReminderRecurrence;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'last_fired_at', type: 'timestamp', nullable: true })
  lastFiredAt!: Date | null;
}
