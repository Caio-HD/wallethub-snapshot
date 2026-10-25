import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { RagChunkEntity } from './rag-chunk.entity.js';
import { UserEntity } from './user.entity.js';

@Entity({ name: 'rag_documents' })
export class RagDocumentEntity extends BaseEntity {
  @Column({ name: 'source_key' })
  @Index()
  sourceKey!: string;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  @Index()
  ownerUserId?: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  ownerUser?: Relation<UserEntity> | null;

  @Column({ type: 'varchar', nullable: true })
  title?: string | null;

  @Column({ name: 'content_hash' })
  contentHash!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @OneToMany(() => RagChunkEntity, (c) => c.document)
  chunks!: Relation<RagChunkEntity>[];
}
