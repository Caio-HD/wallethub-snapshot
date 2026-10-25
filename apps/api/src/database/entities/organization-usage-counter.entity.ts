import { Column, Entity, Index, JoinColumn, ManyToOne, Relation, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrganizationEntity } from './organization.entity';

@Entity({ name: 'organization_usage_counters' })
@Unique(['organizationId', 'periodYyyymm'])
export class OrganizationUsageCounterEntity extends BaseEntity {
  @Column({ name: 'organization_id' })
  @Index()
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Relation<OrganizationEntity>;

  @Column({ name: 'period_yyyymm', type: 'varchar', length: 7 })
  periodYyyymm!: string;

  /** Quota mensal partilhada: mensagens IA via WhatsApp ou Telegram. */
  @Column({ name: 'ai_messaging_assistant_messages', type: 'int', default: 0 })
  aiMessagingAssistantMessages!: number;

  @Column({ name: 'statement_imports', type: 'int', default: 0 })
  statementImports!: number;
}
