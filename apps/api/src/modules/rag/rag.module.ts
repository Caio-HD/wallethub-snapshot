import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RagDocumentEntity } from '../../database/entities/rag-document.entity';
import { RagChunkRepository } from './rag-chunk.repository';
import { RagEmbeddingService } from './rag-embedding.service';
import { RagIngestService } from './rag-ingest.service';
import { RagSearchService } from './rag-search.service';
import { UserRagController } from './user-rag.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([RagDocumentEntity])],
  controllers: [UserRagController],
  providers: [RagChunkRepository, RagEmbeddingService, RagIngestService, RagSearchService],
  exports: [RagChunkRepository, RagEmbeddingService, RagIngestService, RagSearchService],
})
export class RagModule {}
