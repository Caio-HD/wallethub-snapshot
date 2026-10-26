import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Relation } from 'typeorm';
import { PgEnumNames } from '../pg-enum-names';
import { BaseEntity } from './base.entity';
import { TransactionEntity } from './transaction.entity';
import { OrganizationEntity } from './organization.entity';

export type TelegramEventDirection = 'inbound' | 'outbound';
export type TelegramEventStatus = 'received' | 'processed' | 'failed';

@Entity({ name: 'telegram_events' })
@Index(['organizationId', 'createdAt'])
export class TelegramEventEntity extends BaseEntity {
  @Column({ name: 'organization_id' })
  @Index()
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Relation<OrganizationEntity>;

  @Column({ name: 'provider_message_id', unique: true })
  @Index()
  providerMessageId!: string;

  @Column({ name: 'from_telegram_user_id' })
  fromTelegramUserId!: string;

  @Column({
    type: 'enum',
    enum: ['inbound', 'outbound'],
    enumName: PgEnumNames.whatsappEventDirection,
  })
  direction!: TelegramEventDirection;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'parsed_command', nullable: true })
  parsedCommand?: string;

  @Column({
    type: 'enum',
    enum: ['received', 'processed', 'failed'],
    enumName: PgEnumNames.whatsappEventStatus,
    default: 'received',
  })
  status!: TelegramEventStatus;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt?: Date;

  @OneToMany(() => TransactionEntity, (transaction) => transaction.telegramEvent)
  transactions!: Relation<TransactionEntity>[];
}
