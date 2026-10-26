import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RagConfig } from '../../core/config/rag.config';
import { RagChunkRepository, type RagSearchRow } from './rag-chunk.repository';
import { RagEmbeddingService } from './rag-embedding.service';

@Injectable()
export class RagSearchService {
  constructor(
    private readonly configService: ConfigService,
    private readonly chunks: RagChunkRepository,
    private readonly embeddings: RagEmbeddingService,
  ) {}

  private getRag(): RagConfig {
    return this.configService.getOrThrow<RagConfig>('rag');
  }

  isEnabled(): boolean {
    return this.getRag().enabled;
  }

  async search(
    query: string,
    topK: number | undefined,
    requestingUserId: string,
  ): Promise<RagSearchRow[]> {
    const rag = this.getRag();
    if (!rag.enabled) return [];
    const k = Math.min(50, Math.max(1, topK ?? rag.topK));
    const embedding = await this.embeddings.embedText(query);
    return this.chunks.searchSimilar(embedding, k, requestingUserId);
  }
}
