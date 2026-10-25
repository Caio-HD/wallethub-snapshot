import { Column, Entity, Index, OneToMany, Relation } from 'typeorm';
import { PgEnumNames } from '../pg-enum-names.js';
import { BaseEntity } from './base.entity.js';
import { TransactionEntity } from './transaction.entity.js';
import { WhatsAppAiContextEntity } from './whatsapp-ai-context.entity.js';

export type WhatsAppEventDirection = 'inbound' | 'outbound';
export type WhatsAppEventStatus = 'received' | 'processed' | 'failed';

@Entity({ name: 'whatsapp_events' })
export class WhatsAppEventEntity extends BaseEntity {
  @Column({ name: 'provider_message_id', unique: true })
  @Index()
  providerMessageId!: string;

  @Column({ name: 'from_number' })
  fromNumber!: string;

  @Column({
    type: 'enum',
    enum: ['inbound', 'outbound'],
    enumName: PgEnumNames.whatsappEventDirection,
  })
  direction!: WhatsAppEventDirection;

  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  @Column({ name: 'parsed_command', nullable: true })
  parsedCommand?: string;

  @Column({
    type: 'enum',
    enum: ['received', 'processed', 'failed'],
    enumName: PgEnumNames.whatsappEventStatus,
    default: 'received',
  })
  status!: WhatsAppEventStatus;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt?: Date;

  @OneToMany(() => TransactionEntity, (transaction) => transaction.whatsAppEvent)
  transactions!: Relation<TransactionEntity>[];

  @OneToMany(() => WhatsAppAiContextEntity, (context) => context.event)
  aiContexts!: Relation<WhatsAppAiContextEntity>[];
}
