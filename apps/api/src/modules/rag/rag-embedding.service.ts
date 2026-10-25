import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { RagConfig } from '../../core/config/rag.config';

@Injectable()
export class RagEmbeddingService {
  private readonly logger = new Logger(RagEmbeddingService.name);

  constructor(private readonly configService: ConfigService) {}

  private getRag(): RagConfig {
    return this.configService.getOrThrow<RagConfig>('rag');
  }

  isEnabled(): boolean {
    return this.getRag().enabled;
  }

  async embedText(text: string): Promise<number[]> {
    const rag = this.getRag();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      throw new Error('OPENAI_API_KEY em falta para embeddings RAG');
    }
    const client = new OpenAI({ apiKey });
    const res = await client.embeddings.create({
      model: rag.embeddingModel,
      input: text.replace(/\s+/g, ' ').trim().slice(0, 8000),
    });
    const vec = res.data[0]?.embedding;
    if (!vec?.length) {
      throw new Error('Resposta de embedding vazia');
    }
    if (vec.length !== rag.embeddingDimensions) {
      this.logger.warn(
        `Dimensão do embedding (${vec.length}) difere de RAG_EMBEDDING_DIMENSIONS (${rag.embeddingDimensions})`,
      );
    }
    return vec;
  }
}
