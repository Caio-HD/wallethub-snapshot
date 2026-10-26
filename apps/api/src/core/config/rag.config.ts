import { registerAs } from '@nestjs/config';

export interface RagConfig {
  enabled: boolean;
  embeddingModel: string;
  embeddingDimensions: number;
  topK: number;
  chunkSizeChars: number;
  chunkOverlapChars: number;
  maxObservationPayloadChars: number;
}

export const ragConfig = registerAs('rag', (): RagConfig => {
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim());
  const explicitlyOff = process.env.RAG_ENABLED === 'false';
  const enabled = hasOpenAi && !explicitlyOff;

  return {
    enabled,
    embeddingModel: process.env.RAG_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    embeddingDimensions: Number(process.env.RAG_EMBEDDING_DIMENSIONS ?? 1536),
    topK: Number(process.env.RAG_TOP_K ?? 8),
    chunkSizeChars: Number(process.env.RAG_CHUNK_SIZE_CHARS ?? 1200),
    chunkOverlapChars: Number(process.env.RAG_CHUNK_OVERLAP_CHARS ?? 200),
    maxObservationPayloadChars: Number(process.env.AI_OBSERVATION_MAX_PAYLOAD_CHARS ?? 16_000),
  };
});
