import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AiConversationSessionEntity,
  type AiChannel,
} from '../../../database/entities/ai-conversation-session.entity';
import {
  AiAgentTraceEntity,
  type AiTraceStatus,
} from '../../../database/entities/ai-agent-trace.entity';
import {
  AiTraceObservationEntity,
  type AiObservationType,
} from '../../../database/entities/ai-trace-observation.entity';

function utcSessionDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class AiTracingService {
  constructor(
    @InjectRepository(AiConversationSessionEntity)
    private readonly sessions: Repository<AiConversationSessionEntity>,
    @InjectRepository(AiAgentTraceEntity)
    private readonly traces: Repository<AiAgentTraceEntity>,
    @InjectRepository(AiTraceObservationEntity)
    private readonly observations: Repository<AiTraceObservationEntity>,
  ) {}

  isTracingEnabled(): boolean {
    return process.env.AI_TRACE_ENABLED !== 'false';
  }

  async startTrace(params: {
    userId: string;
    channel: AiChannel;
    whatsappEventId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<{ traceId: string; sessionId: string; seq: { next: () => number } } | null> {
    if (!this.isTracingEnabled()) return null;

    const sessionDate = utcSessionDate(new Date());
    let session = await this.sessions.findOne({
      where: { userId: params.userId, channel: params.channel, sessionDate },
    });
    if (!session) {
      session = await this.sessions.save(
        this.sessions.create({
          userId: params.userId,
          channel: params.channel,
          sessionDate,
          metadata: params.metadata ?? null,
        }),
      );
    }

    const trace = await this.traces.save(
      this.traces.create({
        sessionId: session.id,
        whatsappEventId: params.whatsappEventId ?? null,
        status: 'running',
        startedAt: new Date(),
      }),
    );

    let n = 0;
    const seq = {
      next: () => {
        n += 1;
        return n;
      },
    };

    return { traceId: trace.id, sessionId: session.id, seq };
  }

  async appendObservation(
    traceId: string,
    sequence: number,
    observationType: AiObservationType,
    name: string | null,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.isTracingEnabled()) return;
    const max = Number(process.env.AI_OBSERVATION_MAX_PAYLOAD_CHARS ?? 16_000);
    const trimmed = this.truncatePayload(payload, max);
    await this.observations.save(
      this.observations.create({
        traceId,
        sequence,
        observationType,
        name: name ?? null,
        payload: trimmed,
      }),
    );
  }

  private truncatePayload(
    payload: Record<string, unknown>,
    maxChars: number,
  ): Record<string, unknown> {
    const json = JSON.stringify(payload);
    if (json.length <= maxChars) return payload;
    return {
      _truncated: true,
      _originalLength: json.length,
      preview: json.slice(0, maxChars),
    };
  }

  async finalizeTrace(
    traceId: string,
    status: AiTraceStatus,
    params: {
      provider?: string | null;
      model?: string | null;
      usage?: Record<string, unknown> | null;
      finalReply?: string | null;
      errorMessage?: string | null;
    },
  ): Promise<void> {
    if (!this.isTracingEnabled()) return;
    const trace = await this.traces.findOne({ where: { id: traceId } });
    if (!trace) return;
    trace.status = status;
    trace.finishedAt = new Date();
    trace.provider = params.provider ?? null;
    trace.model = params.model ?? null;
    trace.usage = params.usage ?? null;
    trace.finalReply = params.finalReply ?? null;
    trace.errorMessage = params.errorMessage ?? null;
    await this.traces.save(trace);
  }
}
