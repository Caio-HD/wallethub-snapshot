import { Body, Controller, Get, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConnectorTokenGuard } from './connector-token.guard.js';
import { IngestStatementDto } from './dto/ingest-statement.dto.js';
import { ZenrickIngestService, ZenrickIngestResponse } from './zenrick-ingest.service.js';

/**
 * Superfície S2S do ecossistema Zenrick (Kyron) — ADR adr-zenrick-connector.
 * Guard próprio (token dedicado) + rate limit; organização explícita no body,
 * validada contra a allowlist — nunca ActiveOrganizationGuard (fluxo JWT).
 */
@Controller('integrations/zenrick')
@UseGuards(ConnectorTokenGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class ZenrickIngestController {
  constructor(private readonly ingest: ZenrickIngestService) {}

  @Post('statements')
  @HttpCode(200)
  ingestStatement(
    @Body() dto: IngestStatementDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<ZenrickIngestResponse> {
    return this.ingest.ingestStatement(dto, idempotencyKey ?? '');
  }

  /** Health da superfície do connector (autenticado — não expõe config a anônimos). */
  @Get('health')
  health(): { ok: true; allowedOrgs: number } {
    const allowed = (process.env.WALLETHUB_CONNECTOR_ALLOWED_ORGS ?? '')
      .split(',')
      .filter((s) => s.trim()).length;
    return { ok: true, allowedOrgs: allowed };
  }
}
