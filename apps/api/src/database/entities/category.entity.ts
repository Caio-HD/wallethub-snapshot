import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Relation, Unique } from 'typeorm';
import { PgEnumNames } from '../pg-enum-names.js';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';
import { TransactionEntity } from './transaction.entity.js';
import { OrganizationEntity } from './organization.entity.js';

export type CategoryType = 'income' | 'expense' | 'transfer';

@Entity({ name: 'categories' })
@Unique(['organizationId', 'name'])
export class CategoryEntity extends BaseEntity {
  @Column({ name: 'organization_id' })
  @Index()
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Relation<OrganizationEntity>;

  @Column()
  @Index()
  name!: string;

  @Column({
    type: 'enum',
    enum: ['income', 'expense', 'transfer'],
    enumName: PgEnumNames.categoryType,
    default: 'expense',
  })
  type!: CategoryType;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  @Index()
  ownerUserId!: string | null;

  @ManyToOne(() => UserEntity, {
    nullable: true,
    onDelete: 'SET NULL',
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'owner_user_id' })
  ownerUser?: Relation<UserEntity> | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  /** Categoria gerida pelo sistema (ex.: "Sem categoria") — não editável/excluível pelo usuário. */
  @Column({ name: 'is_system', default: false })
  isSystem!: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: Relation<UserEntity>;

  @OneToMany(() => TransactionEntity, (transaction) => transaction.category)
  transactions!: TransactionEntity[];
}
