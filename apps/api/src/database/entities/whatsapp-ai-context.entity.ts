import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { WhatsAppEventEntity } from './whatsapp-event.entity.js';

@Entity({ name: 'whatsapp_ai_contexts' })
export class WhatsAppAiContextEntity extends BaseEntity {
  @Column({ name: 'event_id' })
  @Index()
  eventId!: string;

  @ManyToOne(() => WhatsAppEventEntity, (event) => event.aiContexts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: Relation<WhatsAppEventEntity>;

  @Column({ name: 'provider', length: 32 })
  provider!: string;

  @Column({ name: 'model', type: 'varchar', length: 128, nullable: true })
  model?: string | null;

  @Column({ name: 'input_text', type: 'text' })
  inputText!: string;

  @Column({ name: 'reply_text', type: 'text' })
  replyText!: string;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt?: Date | null;
}
