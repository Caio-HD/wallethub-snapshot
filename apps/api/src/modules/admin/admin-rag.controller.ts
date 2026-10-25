import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ElevatedAccessGuard } from '../../common/security/elevated-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AdminRagService } from './admin-rag.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformAudit } from './platform-audit.decorator';
import { UpsertRagDocumentDto } from '../rag/dto/upsert-rag-document.dto';

// Platform-management endpoint — restricted to the platform operator (see admin-users.controller).
// Owns the full lifecycle (read + write) of the platform-wide RAG corpus; the previous open
// `@Roles('admin')` /rag write routes (== any authenticated user) were folded in here.
@Controller('admin/rag')
@UseGuards(JwtAuthGuard, RolesGuard, ElevatedAccessGuard)
@Roles('super_admin')
export class AdminRagController {
  constructor(
    private readonly adminRag: AdminRagService,
    private readonly audit: PlatformAuditService,
  ) {}

  @Get('documents')
  async list(@Query('page') pageRaw?: string, @Query('limit') limitRaw?: string) {
    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw ?? '20', 10) || 20));
    return this.adminRag.list({ page, limit });
  }

  @Get('documents/:sourceKey')
  async getOne(@Param('sourceKey') sourceKey: string) {
    return this.adminRag.getBySourceKey(decodeURIComponent(sourceKey));
  }

  @Post('documents')
  @PlatformAudit({ action: 'update', entityType: 'rag_document' })
  async upsert(@CurrentUser() actor: AuthenticatedUser, @Body() dto: UpsertRagDocumentDto) {
    return this.audit.auditedMutation(
      { actorUserId: actor.id, action: 'update', entityType: 'rag_document' },
      () => this.adminRag.tryGetBySourceKey(dto.sourceKey),
      () =>
        this.adminRag.upsert({
          sourceKey: dto.sourceKey,
          title: dto.title,
          body: dto.body,
          metadata: dto.metadata,
        }),
      (doc) => ({ sourceKey: dto.sourceKey, title: dto.title ?? null, document: doc }),
    );
  }

  @Delete('documents/:sourceKey')
  @PlatformAudit({ action: 'deactivate', entityType: 'rag_document' })
  async remove(@CurrentUser() actor: AuthenticatedUser, @Param('sourceKey') sourceKey: string) {
    const key = decodeURIComponent(sourceKey);
    return this.audit.auditedMutation(
      { actorUserId: actor.id, action: 'deactivate', entityType: 'rag_document' },
      () => this.adminRag.tryGetBySourceKey(key),
      () => this.adminRag.remove(key),
      (res) => res as { deleted: boolean },
    );
  }
}
