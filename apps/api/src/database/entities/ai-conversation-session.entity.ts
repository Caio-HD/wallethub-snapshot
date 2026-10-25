import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Relation } from 'typeorm';
import { PgEnumNames } from '../pg-enum-names.js';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';
import { AiAgentTraceEntity } from './ai-agent-trace.entity.js';

export type AiChannel = 'web' | 'whatsapp' | 'telegram';

@Entity({ name: 'ai_conversation_sessions' })
export class AiConversationSessionEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'user_id' })
  @Index()
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<UserEntity>;

  @Column({
    type: 'enum',
    enum: ['web', 'whatsapp', 'telegram'],
    enumName: PgEnumNames.aiChannel,
  })
  channel!: AiChannel;

  @Column({ name: 'session_date', type: 'date' })
  sessionDate!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @OneToMany(() => AiAgentTraceEntity, (trace) => trace.session)
  traces!: Relation<AiAgentTraceEntity>[];
}
