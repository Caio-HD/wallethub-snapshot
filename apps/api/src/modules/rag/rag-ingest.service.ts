import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Equal, IsNull, Repository } from 'typeorm';
import { RagDocumentEntity } from '../../database/entities/rag-document.entity';
import type { RagConfig } from '../../core/config/rag.config';
import { RagChunkRepository } from './rag-chunk.repository';
import { RagEmbeddingService } from './rag-embedding.service';

@Injectable()
export class RagIngestService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(RagDocumentEntity)
    private readonly documents: Repository<RagDocumentEntity>,
    private readonly chunks: RagChunkRepository,
    private readonly embeddings: RagEmbeddingService,
  ) {}

  private getRag(): RagConfig {
    return this.configService.getOrThrow<RagConfig>('rag');
  }

  private splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];
    const parts: string[] = [];
    let start = 0;
    while (start < normalized.length) {
      const end = Math.min(start + chunkSize, normalized.length);
      parts.push(normalized.slice(start, end));
      if (end >= normalized.length) break;
      start = Math.max(0, end - overlap);
    }
    return parts;
  }

  async upsertDocument(params: {
    sourceKey: string;
    title?: string | null;
    body: string;
    metadata?: Record<string, unknown> | null;
    /** null/undefined = documento global (admin). UUID = documento pessoal. */
    ownerUserId?: string | null;
  }): Promise<{ documentId: string; chunkCount: number }> {
    const rag = this.getRag();
    if (!rag.enabled) {
      throw new Error('RAG desativado (OPENAI_API_KEY ou RAG_ENABLED=false)');
    }
    const ownerUserId = params.ownerUserId ?? null;
    const contentHash = createHash('sha256').update(params.body, 'utf8').digest('hex');
    const where =
      ownerUserId == null
        ? { sourceKey: params.sourceKey, ownerUserId: IsNull() }
        : { sourceKey: params.sourceKey, ownerUserId: Equal(ownerUserId) };
    let doc = await this.documents.findOne({ where });
    if (!doc) {
      doc = this.documents.create({
        sourceKey: params.sourceKey,
        title: params.title ?? null,
        contentHash,
        metadata: params.metadata ?? null,
        ownerUserId,
      });
    } else {
      doc.title = params.title ?? doc.title;
      doc.contentHash = contentHash;
      doc.metadata = params.metadata ?? doc.metadata;
    }
    doc = await this.documents.save(doc);
    await this.chunks.deleteByDocumentId(doc.id);

    const pieces = this.splitIntoChunks(params.body, rag.chunkSizeChars, rag.chunkOverlapChars);
    let index = 0;
    for (const piece of pieces) {
      const embedding = await this.embeddings.embedText(piece);
      await this.chunks.insertChunkWithEmbedding({
        documentId: doc.id,
        chunkIndex: index,
        content: piece,
        metadata: { sourceKey: params.sourceKey },
        embedding,
      });
      index += 1;
    }
    return { documentId: doc.id, chunkCount: pieces.length };
  }

  async deleteBySourceKey(sourceKey: string, ownerUserId?: string | null): Promise<boolean> {
    const where =
      ownerUserId == null || ownerUserId === undefined
        ? { sourceKey, ownerUserId: IsNull() }
        : { sourceKey, ownerUserId: Equal(ownerUserId) };
    const doc = await this.documents.findOne({ where });
    if (!doc) return false;
    await this.chunks.deleteByDocumentId(doc.id);
    await this.documents.remove(doc);
    return true;
  }
}
