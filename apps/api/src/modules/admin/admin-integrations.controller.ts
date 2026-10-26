import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ElevatedAccessGuard } from '../../common/security/elevated-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import type { RagConfig } from '../../core/config/rag.config';
import type { McpConfig } from '../../core/config/mcp.config';
import { NotionService } from '../notion/notion.service';
import { SyncRequestDto } from '../notion/dto/sync-request.dto';
import { NotionConfig, defaultNotionConfig } from '../../core/config/notion.config';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformAudit } from './platform-audit.decorator';
import { HealthService } from '../health/health.service';
import { EvolutionOtpAdminService } from './evolution-otp-admin.service';
import { UpdateOtpWhatsAppDto } from './dto/update-otp-whatsapp.dto';

// Platform-management endpoint — restricted to the platform operator (see admin-users.controller).
// Notion status/sync were folded in here from the previous open `@Roles('admin')` /notion routes
// (== any authenticated user); the public Meta webhooks stay on NotionController.
@Controller('admin/integrations')
@UseGuards(JwtAuthGuard, RolesGuard, ElevatedAccessGuard)
@Roles('super_admin')
export class AdminIntegrationsController {
  constructor(
    private readonly configService: ConfigService,
    private readonly notionService: NotionService,
    private readonly audit: PlatformAuditService,
    private readonly healthService: HealthService,
    private readonly evolutionOtp: EvolutionOtpAdminService,
  ) {}

  @Get('queues')
  queues() {
    return this.healthService.getQueueMetrics();
  }

  @Get('status')
  status() {
    const rag = this.configService.get<RagConfig>('rag');
    const mcp = this.configService.get<McpConfig>('mcp');
    const mcpConfigured = Boolean(mcp?.servers?.length);
    return {
      ragEnabled: Boolean(rag?.enabled),
      mcpConfigured,
      mcpServerCount: mcp?.servers?.length ?? 0,
    };
  }

  @Get('notion/status')
  notionStatus() {
    const config = this.configService.get<NotionConfig>('notion') ?? defaultNotionConfig;
    const enabled = this.notionService.isEnabled();
    const configured = !!(
      config.apiKey &&
      config.transactionsDbId &&
      config.accountsDbId &&
      config.categoriesDbId &&
      config.projectionsDbId
    );
    return {
      enabled,
      configured,
      databases: {
        transactions: config.transactionsDbId ?? 'not configured',
        accounts: config.accountsDbId ?? 'not configured',
        categories: config.categoriesDbId ?? 'not configured',
        projections: config.projectionsDbId ?? 'not configured',
      },
    };
  }

  @Post('notion/sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @PlatformAudit({ action: 'update', entityType: 'notion_sync' })
  async notionSync(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: SyncRequestDto,
  ): Promise<{ message: string; queued: number }> {
    if (!this.notionService.isEnabled()) {
      throw new BadRequestException('Notion sync is disabled');
    }
    // Trigger (no entity before/after); record the operator intent with the requested scope.
    await this.audit.record({
      actorUserId: actor.id,
      action: 'update',
      entityType: 'notion_sync',
      query: { entityType: dto.entityType },
    });
    return { message: `Sync queued for ${dto.entityType}`, queued: 0 };
  }

  // --- OTP por WhatsApp (Evolution, instância única global) ---

  @Get('evolution/otp')
  otpWhatsAppStatus() {
    return this.evolutionOtp.getStatus();
  }

  @Post('evolution/otp/instance')
  @HttpCode(HttpStatus.CREATED)
  @PlatformAudit({ action: 'create', entityType: 'evolution_otp_instance' })
  async otpCreateInstance(@CurrentUser() actor: AuthenticatedUser) {
    const result = await this.evolutionOtp.createInstance();
    await this.audit.record({
      actorUserId: actor.id,
      action: 'create',
      entityType: 'evolution_otp_instance',
      after: result,
    });
    return result;
  }

  @Post('evolution/otp/connect')
  @HttpCode(HttpStatus.OK)
  @PlatformAudit({ action: 'update', entityType: 'evolution_otp_instance' })
  async otpConnect(@CurrentUser() actor: AuthenticatedUser) {
    const qr = await this.evolutionOtp.connect();
    await this.audit.record({
      actorUserId: actor.id,
      action: 'update',
      entityType: 'evolution_otp_instance',
      query: { op: 'connect' },
    });
    return qr;
  }

  @Post('evolution/otp/logout')
  @HttpCode(HttpStatus.OK)
  @PlatformAudit({ action: 'update', entityType: 'evolution_otp_instance' })
  async otpLogout(@CurrentUser() actor: AuthenticatedUser) {
    const result = await this.evolutionOtp.logout();
    await this.audit.record({
      actorUserId: actor.id,
      action: 'update',
      entityType: 'evolution_otp_instance',
      query: { op: 'logout' },
    });
    return result;
  }

  @Patch('evolution/otp')
  @PlatformAudit({ action: 'update', entityType: 'otp_whatsapp' })
  async otpUpdateSettings(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateOtpWhatsAppDto,
  ) {
    const before = await this.evolutionOtp.getSettings();
    const after = await this.evolutionOtp.setSettings(dto);
    await this.audit.record({
      actorUserId: actor.id,
      action: 'update',
      entityType: 'otp_whatsapp',
      before: { ...before },
      after: { ...after },
    });
    return after;
  }
}
