import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Relation } from 'typeorm';
import { PgEnumNames } from '../pg-enum-names.js';
import { BaseEntity } from './base.entity.js';
import { AiConversationSessionEntity } from './ai-conversation-session.entity.js';
import { WhatsAppEventEntity } from './whatsapp-event.entity.js';
import { AiTraceObservationEntity } from './ai-trace-observation.entity.js';

export type AiTraceStatus = 'running' | 'completed' | 'failed';

@Entity({ name: 'ai_agent_traces' })
export class AiAgentTraceEntity extends BaseEntity {
  @Column({ name: 'session_id' })
  @Index()
  sessionId!: string;

  @ManyToOne(() => AiConversationSessionEntity, (s) => s.traces, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session!: Relation<AiConversationSessionEntity>;

  @Column({ name: 'whatsapp_event_id', nullable: true })
  whatsappEventId?: string | null;

  @ManyToOne(() => WhatsAppEventEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'whatsapp_event_id' })
  whatsappEvent?: Relation<WhatsAppEventEntity> | null;

  @Column({
    type: 'enum',
    enum: ['running', 'completed', 'failed'],
    enumName: PgEnumNames.aiTraceStatus,
    default: 'running',
  })
  status!: AiTraceStatus;

  @Column({ type: 'varchar', length: 32, nullable: true })
  provider?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  model?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  usage?: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'final_reply', type: 'text', nullable: true })
  finalReply?: string | null;

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt!: Date;

  @Column({ name: 'finished_at', type: 'timestamp', nullable: true })
  finishedAt?: Date | null;

  @OneToMany(() => AiTraceObservationEntity, (o) => o.trace)
  observations!: Relation<AiTraceObservationEntity>[];
}
