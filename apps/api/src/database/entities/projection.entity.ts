import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { PgEnumNames } from '../pg-enum-names.js';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';
import { OrganizationEntity } from './organization.entity.js';

export type ProjectionTrend = 'up' | 'flat' | 'down';

@Entity({ name: 'projections' })
export class ProjectionEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  @Index()
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Relation<OrganizationEntity>;

  @Column({ name: 'period_start', type: 'date' })
  @Index()
  periodStart!: Date;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd!: Date;

  @Column({ name: 'scope_user_id', type: 'uuid', nullable: true })
  @Index()
  scopeUserId!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'scope_user_id' })
  scopeUser?: Relation<UserEntity> | null;

  @Column({ name: 'projected_income', type: 'numeric', precision: 12, scale: 2 })
  projectedIncome!: string;

  @Column({ name: 'projected_expense', type: 'numeric', precision: 12, scale: 2 })
  projectedExpense!: string;

  @Column({ name: 'projected_balance', type: 'numeric', precision: 12, scale: 2 })
  projectedBalance!: string;

  @Column({
    type: 'enum',
    enum: ['up', 'flat', 'down'],
    enumName: PgEnumNames.projectionTrend,
    default: 'flat',
  })
  trend!: ProjectionTrend;

  @Column({ name: 'generated_at', type: 'timestamp' })
  generatedAt!: Date;
}
