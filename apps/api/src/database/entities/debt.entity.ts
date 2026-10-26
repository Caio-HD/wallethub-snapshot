import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Relation } from 'typeorm';
import { PgEnumNames } from '../pg-enum-names.js';
import { BaseEntity } from './base.entity.js';
import { OrganizationEntity } from './organization.entity.js';
import { CategoryEntity } from './category.entity.js';
import { AccountEntity } from './account.entity.js';
import { DebtInstallmentEntity } from './debt-installment.entity.js';

export type DebtKind = 'installment';
export type DebtStatus = 'active' | 'paid_off' | 'paused';

@Entity({ name: 'debts' })
@Index(['organizationId', 'status'])
export class DebtEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  @Index()
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Relation<OrganizationEntity>;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  creditor!: string | null;

  @Column({
    type: 'enum',
    enum: ['installment'],
    enumName: PgEnumNames.debtKind,
    default: 'installment',
  })
  kind!: DebtKind;

  @Column({
    type: 'enum',
    enum: ['active', 'paid_off', 'paused'],
    enumName: PgEnumNames.debtStatus,
    default: 'active',
  })
  status!: DebtStatus;

  @Column({ name: 'principal_amount', type: 'numeric', precision: 12, scale: 2 })
  principalAmount!: string;

  @Column({ name: 'installment_amount', type: 'numeric', precision: 12, scale: 2 })
  installmentAmount!: string;

  @Column({ name: 'total_installments', type: 'int' })
  totalInstallments!: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @ManyToOne(() => CategoryEntity, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'category_id' })
  category!: Relation<CategoryEntity>;

  @Column({ name: 'account_id', type: 'uuid', nullable: true })
  accountId!: string | null;

  @ManyToOne(() => AccountEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'account_id' })
  account?: Relation<AccountEntity> | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => DebtInstallmentEntity, (i) => i.debt)
  installments!: Relation<DebtInstallmentEntity>[];
}
