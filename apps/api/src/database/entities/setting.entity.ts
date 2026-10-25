import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';
import { OrganizationEntity } from './organization.entity.js';

@Entity({ name: 'settings' })
export class SettingEntity extends BaseEntity {
  @Column({ name: 'organization_id' })
  @Index()
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Relation<OrganizationEntity>;

  @Column()
  @Index()
  key!: string;

  @Column({ type: 'jsonb' })
  value!: Record<string, unknown>;

  @Column({ name: 'scope_user_id', type: 'uuid', nullable: true })
  scopeUserId!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'scope_user_id' })
  scopeUser?: Relation<UserEntity> | null;
}
