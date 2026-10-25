import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';

/** Serializa vetor para literal aceite por `::vector` no PostgreSQL/pgvector. */
export function vectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

export interface RagSearchRow {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown> | null;
  distance: number;
}

@Injectable()
export class RagChunkRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async insertChunkWithEmbedding(params: {
    documentId: string;
    chunkIndex: number;
    content: string;
    metadata: Record<string, unknown> | null;
    embedding: number[];
  }): Promise<string> {
    const id = randomUUID();
    const vec = vectorLiteral(params.embedding);
    await this.dataSource.query(
      `INSERT INTO rag_chunks (id, created_at, updated_at, document_id, chunk_index, content, metadata, embedding)
       VALUES ($1, now(), now(), $2, $3, $4, $5, $6::vector)`,
      [id, params.documentId, params.chunkIndex, params.content, params.metadata, vec],
    );
    return id;
  }

  /**
   * Documentos globais (`owner_user_id` NULL) + documentos pessoais do utilizador.
   */
  async searchSimilar(
    embedding: number[],
    limit: number,
    requestingUserId: string,
  ): Promise<RagSearchRow[]> {
    const vec = vectorLiteral(embedding);
    return await this.dataSource.query(
      `SELECT c.id, c.document_id AS "documentId", c.chunk_index AS "chunkIndex",
              c.content, c.metadata, (c.embedding <=> $1::vector) AS distance
       FROM rag_chunks c
       INNER JOIN rag_documents d ON d.id = c.document_id AND d.deleted_at IS NULL
       WHERE c.deleted_at IS NULL
         AND (d.owner_user_id IS NULL OR d.owner_user_id = $3)
       ORDER BY c.embedding <=> $1::vector
       LIMIT $2`,
      [vec, limit, requestingUserId],
    );
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.dataSource.query(`DELETE FROM rag_chunks WHERE document_id = $1`, [documentId]);
  }
}
