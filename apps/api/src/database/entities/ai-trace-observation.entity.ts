import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { CreateDateColumn } from 'typeorm';
import { PgEnumNames } from '../pg-enum-names.js';
import { AiAgentTraceEntity } from './ai-agent-trace.entity.js';

export type AiObservationType = 'user_message' | 'llm' | 'tool' | 'retrieval' | 'mcp';

@Entity({ name: 'ai_trace_observations' })
export class AiTraceObservationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'trace_id' })
  @Index()
  traceId!: string;

  @ManyToOne(() => AiAgentTraceEntity, (t) => t.observations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trace_id' })
  trace!: Relation<AiAgentTraceEntity>;

  @Column()
  sequence!: number;

  @Column({
    name: 'observation_type',
    type: 'enum',
    enum: ['user_message', 'llm', 'tool', 'retrieval', 'mcp'],
    enumName: PgEnumNames.aiObservationType,
  })
  observationType!: AiObservationType;

  @Column({ type: 'varchar', length: 256, nullable: true })
  name?: string | null;

  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;
}
