import { Column, Entity, Index, JoinColumn, ManyToOne, Relation, Unique } from 'typeorm';
import { PgEnumNames } from '../pg-enum-names';
import { BaseEntity } from './base.entity';
import { OrganizationEntity } from './organization.entity';
import { UserEntity } from './user.entity';

export type OrganizationMembershipRole = 'owner' | 'admin' | 'member';
export type OrganizationMembershipStatus = 'active' | 'invited';

@Entity({ name: 'organization_memberships' })
@Unique(['organizationId', 'userId'])
export class OrganizationMembershipEntity extends BaseEntity {
  @Column({ name: 'organization_id' })
  @Index()
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, (o) => o.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Relation<OrganizationEntity>;

  @Column({ name: 'user_id' })
  @Index()
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<UserEntity>;

  @Column({
    type: 'enum',
    enum: ['owner', 'admin', 'member'],
    enumName: PgEnumNames.organizationMembershipRole,
    default: 'member',
  })
  role!: OrganizationMembershipRole;

  @Column({
    type: 'enum',
    enum: ['active', 'invited'],
    enumName: PgEnumNames.organizationMembershipStatus,
    default: 'active',
  })
  status!: OrganizationMembershipStatus;

  /**
   * Membro com vaga de IA (WhatsApp/Telegram/Web). Owner e admin ignoram este flag na autorização.
   */
  @Column({ name: 'messaging_ai_enabled', default: false })
  messagingAiEnabled!: boolean;
}
