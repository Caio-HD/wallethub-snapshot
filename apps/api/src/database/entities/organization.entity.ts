import { Column, Entity, OneToMany, Relation } from 'typeorm';
import { PgEnumNames } from '../pg-enum-names';
import { BaseEntity } from './base.entity';
import { OrganizationMembershipEntity } from './organization-membership.entity';

export type OrganizationPlan = 'free' | 'pro' | 'plus';
export type OrganizationTaxIdType = 'cpf' | 'cnpj';

@Entity({ name: 'organizations' })
export class OrganizationEntity extends BaseEntity {
  @Column('varchar', { length: 128 })
  name!: string;

  @Column({ name: 'legal_name', type: 'varchar', length: 256, nullable: true })
  legalName!: string | null;

  @Column({
    name: 'tax_id_type',
    type: 'enum',
    enum: ['cpf', 'cnpj'],
    enumName: PgEnumNames.organizationTaxIdType,
    nullable: true,
  })
  taxIdType!: OrganizationTaxIdType | null;

  /** Dígitos normalizados (sem máscara); único na base quando preenchido. */
  @Column({ name: 'tax_id', type: 'varchar', length: 20, nullable: true })
  taxId!: string | null;

  @Column({
    type: 'enum',
    enum: ['free', 'pro', 'plus'],
    enumName: PgEnumNames.organizationPlan,
    default: 'free',
  })
  plan!: OrganizationPlan;

  @Column({ name: 'is_qa', default: false })
  isQa!: boolean;

  @OneToMany(() => OrganizationMembershipEntity, (m) => m.organization)
  memberships!: Relation<OrganizationMembershipEntity>[];
}
