import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Counter } from 'prom-client';

@Injectable()
export class TelegramObservabilityService {
  constructor(
    @InjectMetric('telegram_inbound_messages_total')
    private readonly inboundCounter: Counter<string>,
    @InjectMetric('telegram_outbound_messages_total')
    private readonly outboundCounter: Counter<string>,
  ) {}

  recordInbound() {
    this.inboundCounter.inc();
  }

  recordOutbound() {
    this.outboundCounter.inc();
  }
}
