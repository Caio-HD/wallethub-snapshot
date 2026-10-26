import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { RagDocumentEntity } from './rag-document.entity.js';

/**
 * Embeddings are stored as pgvector via migration; use RagChunkRepository for INSERT/search with vector type.
 */
@Entity({ name: 'rag_chunks' })
export class RagChunkEntity extends BaseEntity {
  @Column({ name: 'document_id' })
  @Index()
  documentId!: string;

  @ManyToOne(() => RagDocumentEntity, (d) => d.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document!: Relation<RagDocumentEntity>;

  @Column({ name: 'chunk_index' })
  chunkIndex!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;
}
