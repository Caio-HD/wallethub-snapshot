import { Injectable, Logger } from '@nestjs/common';
import { Counter, Gauge, Histogram } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class WhatsAppObservabilityService {
  private readonly logger = new Logger(WhatsAppObservabilityService.name);

  constructor(
    @InjectMetric('whatsapp_inbound_messages_total')
    private readonly inboundMessages: Counter<string>,
    @InjectMetric('whatsapp_outbound_messages_total')
    private readonly outboundMessages: Counter<string>,
    @InjectMetric('whatsapp_connection_status')
    private readonly connectionGauge: Gauge<string>,
    @InjectMetric('whatsapp_ai_tokens_histogram')
    private readonly aiTokensHistogram: Histogram<string>,
    @InjectMetric('whatsapp_message_latency_seconds')
    private readonly messageLatency: Histogram<string>,
    @InjectMetric('whatsapp_digest_sent_total')
    private readonly digestSent: Counter<string>,
  ) {}

  incrementInbound(count = 1) {
    this.inboundMessages.inc(count);
  }

  incrementOutbound(count = 1) {
    this.outboundMessages.inc(count);
  }

  setConnectionStatus(status: 'connected' | 'connecting' | 'qr' | 'disconnected') {
    const mapping: Record<typeof status, number> = {
      connected: 3,
      connecting: 2,
      qr: 1,
      disconnected: 0,
    };
    this.connectionGauge.set(mapping[status]);
    this.logger.debug(`Status de conexão WhatsApp atualizado para ${status}`);
  }

  observeAiTokens(tokens: { input?: number; output?: number; total?: number }) {
    const total = tokens.total ?? 0;
    if (total > 0) {
      this.aiTokensHistogram.observe(total);
    }
  }

  incrementDigestSent(count = 1) {
    this.digestSent.inc(count);
  }

  observeMessageLatency(seconds: number) {
    if (seconds >= 0) {
      this.messageLatency.observe(seconds);
    }
  }
}
