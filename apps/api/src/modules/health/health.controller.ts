import { Controller, Get, Query } from '@nestjs/common';
import { HealthReport, HealthService } from './health.service';
import { AiService } from '../ai/ai.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly aiService: AiService,
  ) {}

  /** Liveness: process is up and accepting HTTP. No DB/Redis/queues. */
  @Get('live')
  getLive(): { status: string } {
    return { status: 'ok' };
  }

  /**
   * LLM health/observability. Config-only by default; `?ping=true` runs a live probe
   * against the OpenRouter primary model. No secrets returned — only model ids.
   */
  @Get('llm')
  getLlm(@Query('ping') ping?: string) {
    return this.aiService.getLlmHealth(ping === 'true');
  }

  /** Readiness: full health (DB, Redis, queues). */
  @Get()
  getHealth(): Promise<HealthReport> {
    return this.healthService.check();
  }
}
