import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RagDocumentEntity } from '../../database/entities/rag-document.entity';
import { RagChunkEntity } from '../../database/entities/rag-chunk.entity';
import { RagIngestService } from '../rag/rag-ingest.service';

@Injectable()
export class AdminRagService {
  constructor(
    @InjectRepository(RagDocumentEntity)
    private readonly documents: Repository<RagDocumentEntity>,
    @InjectRepository(RagChunkEntity)
    private readonly chunks: Repository<RagChunkEntity>,
    private readonly ingest: RagIngestService,
  ) {}

  /**
   * Upsert a platform-wide (owner-less) RAG document. Operator-only: callers reach this through
   * AdminRagController, which is @Roles('super_admin') + ElevatedAccessGuard. Delegates the
   * chunking/embedding pipeline to RagIngestService (single source of ingest truth).
   */
  async upsert(params: {
    sourceKey: string;
    title?: string;
    body: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.ingest.upsertDocument({
      sourceKey: params.sourceKey,
      title: params.title ?? null,
      body: params.body,
      metadata: params.metadata ?? null,
      ownerUserId: null,
    });
  }

  /** Delete a platform-wide (owner-less) RAG document by source key. Operator-only (see upsert). */
  async remove(sourceKey: string): Promise<{ deleted: boolean }> {
    const ok = await this.ingest.deleteBySourceKey(sourceKey, null);
    return { deleted: ok };
  }

  async list(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const [docs, total] = await this.documents.findAndCount({
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const items = await Promise.all(
      docs.map(async (d) => ({
        id: d.id,
        sourceKey: d.sourceKey,
        title: d.title,
        contentHash: d.contentHash,
        metadata: d.metadata,
        ownerUserId: d.ownerUserId ?? null,
        updatedAt: d.updatedAt,
        chunkCount: await this.chunks.count({ where: { documentId: d.id } }),
      })),
    );
    return { items, total, page, limit };
  }

  /**
   * Lightweight pre-state for the audit `before` capture. Unlike `getBySourceKey`, returns `null`
   * instead of throwing when the document does not exist (so audit of a first-time upsert works).
   */
  async tryGetBySourceKey(sourceKey: string): Promise<Record<string, unknown> | null> {
    const doc = await this.documents.findOne({
      where: { sourceKey, ownerUserId: IsNull() },
    });
    if (!doc) {
      return null;
    }
    return { sourceKey: doc.sourceKey, title: doc.title, contentHash: doc.contentHash };
  }

  async getBySourceKey(sourceKey: string) {
    const doc = await this.documents.findOne({
      where: { sourceKey, ownerUserId: IsNull() },
    });
    if (!doc) {
      throw new NotFoundException('Documento não encontrado');
    }
    const parts = await this.chunks.find({
      where: { documentId: doc.id },
      order: { chunkIndex: 'ASC' },
    });
    const body = parts.map((c) => c.content).join('');
    return {
      id: doc.id,
      sourceKey: doc.sourceKey,
      title: doc.title,
      contentHash: doc.contentHash,
      metadata: doc.metadata,
      body,
      chunkCount: parts.length,
      ownerUserId: doc.ownerUserId ?? null,
      updatedAt: doc.updatedAt,
    };
  }
}
