import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConversationSessionEntity } from '../../database/entities/ai-conversation-session.entity';
import { AiAgentTraceEntity } from '../../database/entities/ai-agent-trace.entity';
import { AiTraceObservationEntity } from '../../database/entities/ai-trace-observation.entity';

@Injectable()
export class AdminAiService {
  constructor(
    @InjectRepository(AiConversationSessionEntity)
    private readonly sessions: Repository<AiConversationSessionEntity>,
    @InjectRepository(AiAgentTraceEntity)
    private readonly traces: Repository<AiAgentTraceEntity>,
    @InjectRepository(AiTraceObservationEntity)
    private readonly observations: Repository<AiTraceObservationEntity>,
  ) {}

  async listSessions(params: {
    page: number;
    limit: number;
    userId?: string;
    channel?: 'web' | 'whatsapp';
    from?: Date;
    to?: Date;
  }) {
    const { page, limit, userId, channel, from, to } = params;
    const qb = this.sessions
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .orderBy('s.session_date', 'DESC')
      .addOrderBy('s.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (userId) qb.andWhere('s.user_id = :userId', { userId });
    if (channel) qb.andWhere('s.channel = :channel', { channel });
    if (from && to) {
      qb.andWhere('s.session_date BETWEEN :from AND :to', {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      });
    } else if (from) {
      qb.andWhere('s.session_date >= :from', { from: from.toISOString().slice(0, 10) });
    } else if (to) {
      qb.andWhere('s.session_date <= :to', { to: to.toISOString().slice(0, 10) });
    }
    const [rows, total] = await qb.getManyAndCount();
    const items = rows.map((s) => ({
      id: s.id,
      userId: s.userId,
      userName: s.user?.name ?? null,
      channel: s.channel,
      sessionDate: s.sessionDate,
      createdAt: s.createdAt,
    }));
    return { items, total, page, limit };
  }

  async listTraces(params: {
    page: number;
    limit: number;
    sessionId?: string;
    from?: Date;
    to?: Date;
  }) {
    const { page, limit, sessionId, from, to } = params;
    const qb = this.traces
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.session', 'session')
      .orderBy('t.started_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (sessionId) qb.andWhere('t.session_id = :sessionId', { sessionId });
    if (from && to) {
      qb.andWhere('t.started_at BETWEEN :from AND :to', { from, to });
    } else if (from) {
      qb.andWhere('t.started_at >= :from', { from });
    } else if (to) {
      qb.andWhere('t.started_at <= :to', { to });
    }
    const [rows, total] = await qb.getManyAndCount();
    const items = rows.map((t) => ({
      id: t.id,
      sessionId: t.sessionId,
      channel: t.session?.channel,
      sessionDate: t.session?.sessionDate,
      status: t.status,
      provider: t.provider,
      model: t.model,
      startedAt: t.startedAt,
      finishedAt: t.finishedAt,
      errorMessage: t.errorMessage,
      finalReply: t.finalReply
        ? `${t.finalReply.slice(0, 200)}${t.finalReply.length > 200 ? '…' : ''}`
        : null,
    }));
    return { items, total, page, limit };
  }

  async getTraceDetail(id: string, obsLimit: number) {
    const trace = await this.traces.findOne({
      where: { id },
      relations: ['session', 'session.user'],
    });
    if (!trace) throw new NotFoundException('Trace não encontrado');
    const obs = await this.observations.find({
      where: { traceId: id },
      order: { sequence: 'ASC' },
      take: Math.min(500, Math.max(1, obsLimit)),
    });
    return {
      id: trace.id,
      sessionId: trace.sessionId,
      userId: trace.session?.userId,
      userName: trace.session?.user?.name ?? null,
      channel: trace.session?.channel,
      sessionDate: trace.session?.sessionDate,
      whatsappEventId: trace.whatsappEventId,
      status: trace.status,
      provider: trace.provider,
      model: trace.model,
      usage: trace.usage,
      errorMessage: trace.errorMessage,
      finalReply: trace.finalReply,
      startedAt: trace.startedAt,
      finishedAt: trace.finishedAt,
      observations: obs.map((o) => ({
        id: o.id,
        sequence: o.sequence,
        observationType: o.observationType,
        name: o.name,
        payload: o.payload,
        createdAt: o.createdAt,
      })),
    };
  }
}
