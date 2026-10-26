import { Column, Entity, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';

@Entity({ name: 'monthly_budgets' })
export class MonthlyBudgetEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'scope_user_id', type: 'uuid', nullable: true })
  scopeUserId!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'scope_user_id' })
  scopeUser?: Relation<UserEntity> | null;

  @Column({ type: 'varchar', length: 7 })
  period!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({
    name: 'estimated_average_income',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  estimatedAverageIncome!: string | null;
}
