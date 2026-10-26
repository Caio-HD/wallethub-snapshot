import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RagIngestService } from './rag-ingest.service';
import { UpsertRagDocumentDto } from './dto/upsert-rag-document.dto';

/** RAG privado: documentos escopados ao utilizador autenticado. */
@Controller('users/me/rag')
@UseGuards(JwtAuthGuard)
export class UserRagController {
  constructor(private readonly ingest: RagIngestService) {}

  @Post('documents')
  async upsert(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertRagDocumentDto) {
    return this.ingest.upsertDocument({
      sourceKey: dto.sourceKey,
      title: dto.title ?? null,
      body: dto.body,
      metadata: dto.metadata ?? null,
      ownerUserId: user.id,
    });
  }

  @Delete('documents/:sourceKey')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('sourceKey') sourceKey: string) {
    const ok = await this.ingest.deleteBySourceKey(decodeURIComponent(sourceKey), user.id);
    return { deleted: ok };
  }
}
