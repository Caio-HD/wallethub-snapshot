import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';

@Entity({ name: 'user_ai_contexts' })
export class UserAiContextEntity extends BaseEntity {
  @Column({ name: 'user_id' })
  @Index()
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<UserEntity>;

  @Column({ name: 'role', length: 16 })
  role!: 'system' | 'user' | 'assistant' | 'tool';

  @Column({ name: 'content', type: 'text' })
  content!: string;

  @Column({ name: 'tool_call_id', type: 'varchar', length: 64, nullable: true })
  toolCallId?: string | null;

  @Column({ name: 'name', type: 'varchar', length: 128, nullable: true })
  name?: string | null;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;
}
