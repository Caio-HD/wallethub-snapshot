import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Relation, Unique } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { TransactionEntity } from './transaction.entity.js';
import { OrganizationEntity } from './organization.entity.js';

@Entity({ name: 'accounts' })
@Unique(['organizationId', 'name'])
export class AccountEntity extends BaseEntity {
  @Column({ name: 'organization_id' })
  @Index()
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Relation<OrganizationEntity>;

  @Column()
  name!: string;

  /** Código COMPE do banco (OFX BANKID), ex: '237' = Bradesco, '341' = Itaú. */
  @Column({ name: 'bank_id', type: 'varchar', length: 20, nullable: true })
  bankId!: string | null;

  /** Agência bancária (OFX BRANCHID). */
  @Column({ name: 'branch_number', type: 'varchar', length: 20, nullable: true })
  branchNumber!: string | null;

  /** Número da conta (OFX ACCTID). Usado para casar importações OFX. */
  @Column({ name: 'account_number', type: 'varchar', length: 40, nullable: true })
  accountNumber!: string | null;

  @Column({ name: 'owner_user_ids', type: 'uuid', array: true, nullable: true })
  @Index()
  ownerUserIds!: string[] | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'last_balance_update_at', type: 'timestamp', nullable: true })
  lastBalanceUpdateAt!: Date | null;

  @OneToMany(() => TransactionEntity, (transaction) => transaction.account)
  transactions!: Relation<TransactionEntity>[];
}
