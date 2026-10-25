import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { DeepPartial, Repository } from 'typeorm';
import { WhatsAppEventEntity } from '../../database/entities/whatsapp-event.entity.js';
import { QUEUE_WHATSAPP_INBOUND, QUEUE_WHATSAPP_OUTBOUND } from '../../queues';
import { toWhatsAppPublicConfig, WhatsAppConfig } from '../../core/config/whatsapp.config.js';
import { SettingEntity } from '../../database/entities/setting.entity.js';
import { WhatsAppObservabilityService } from './whatsapp-observability.service.js';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly observability: WhatsAppObservabilityService,
    @InjectRepository(WhatsAppEventEntity)
    private readonly eventsRepository: Repository<WhatsAppEventEntity>,
    @InjectRepository(SettingEntity)
    private readonly settingsRepository: Repository<SettingEntity>,
    @InjectQueue(QUEUE_WHATSAPP_INBOUND)
    private readonly inboundQueue: Queue,
    @InjectQueue(QUEUE_WHATSAPP_OUTBOUND)
    private readonly outboundQueue: Queue,
  ) {}

  private extractText(message: Record<string, unknown> | undefined): string | undefined {
    if (!message) return undefined;
    if (typeof message['conversation'] === 'string') return message['conversation'];
    const ext = message['extendedTextMessage'] as Record<string, unknown> | undefined;
    if (typeof ext?.['text'] === 'string') return ext['text'];
    const img = message['imageMessage'] as Record<string, unknown> | undefined;
    if (typeof img?.['caption'] === 'string') return img['caption'];
    const vid = message['videoMessage'] as Record<string, unknown> | undefined;
    if (typeof vid?.['caption'] === 'string') return vid['caption'];
    const doc = message['documentMessage'] as Record<string, unknown> | undefined;
    if (typeof doc?.['caption'] === 'string') return doc['caption'];
    return undefined;
  }

  async handleEvolutionWebhook(payload: Record<string, unknown>): Promise<void> {
    const config = this.configService.get<WhatsAppConfig>('whatsapp');
    if (config?.evolutionApiKey && payload['apikey'] !== config.evolutionApiKey) {
      this.logger.warn('Webhook Evolution rejeitado: apikey inválida');
      return;
    }

    const event = payload['event'] as string | undefined;
    if (event !== 'messages.upsert') return;

    const data = payload['data'] as Record<string, unknown> | undefined;
    if (!data) return;

    const key = data['key'] as Record<string, unknown> | undefined;
    if (!key) return;

    if (key['fromMe'] === true) return;

    const remoteJid = key['remoteJid'] as string | undefined;
    const providerMessageId = key['id'] as string | undefined;
    if (!remoteJid || !providerMessageId) return;
    if (!remoteJid.endsWith('@s.whatsapp.net')) return;

    const fromNumber = remoteJid.split('@')[0];
    const message = data['message'] as Record<string, unknown> | undefined;
    const text = this.extractText(message);

    const existing = await this.eventsRepository.findOne({ where: { providerMessageId } });
    if (existing) return;

    const partialEvent: DeepPartial<WhatsAppEventEntity> = {
      providerMessageId,
      fromNumber,
      direction: 'inbound',
      payload: payload,
      parsedCommand: text?.slice(0, 30) || undefined,
      status: 'received',
    };
    const entity = this.eventsRepository.create(partialEvent);
    const saved = await this.eventsRepository.save(entity);

    this.observability.incrementInbound();

    await this.inboundQueue.add(
      'inbound-message',
      {
        eventId: saved.id,
        message: {
          id: providerMessageId,
          from: fromNumber,
          text: { body: text },
          timestamp: String(
            (data['messageTimestamp'] as number | string | undefined) ?? Date.now(),
          ),
        },
      },
      { removeOnComplete: true, removeOnFail: false },
    );
  }

  async enqueueOutbound(to: string, body: string) {
    await this.outboundQueue.add(
      'send-message',
      { to, body },
      { removeOnComplete: true, removeOnFail: false },
    );
  }

  async markProcessed(eventId: string) {
    await this.eventsRepository.update(eventId, {
      status: 'processed',
      processedAt: new Date(),
    });
  }

  async markFailed(eventId: string, reason: string) {
    await this.eventsRepository.update(eventId, {
      status: 'failed',
      processedAt: new Date(),
      parsedCommand: reason,
    });
  }

  async getHealth() {
    const [inboundWaiting, inboundActive, outboundWaiting, outboundActive] = await Promise.all([
      this.inboundQueue.getWaitingCount(),
      this.inboundQueue.getActiveCount(),
      this.outboundQueue.getWaitingCount(),
      this.outboundQueue.getActiveCount(),
    ]);

    return {
      provider: 'evolution',
      inbound: { waiting: inboundWaiting, active: inboundActive },
      outbound: { waiting: outboundWaiting, active: outboundActive },
    };
  }

  getPublicConfig() {
    return toWhatsAppPublicConfig(this.configService.get<WhatsAppConfig>('whatsapp'));
  }

  async getWhatsappAiProvider(): Promise<string | undefined> {
    const setting = await this.settingsRepository.findOne({
      where: { key: 'whatsapp_ai_provider' },
    });
    return (setting?.value?.provider as string) || undefined;
  }

  async setWhatsappAiProvider(provider: string): Promise<void> {
    let setting = await this.settingsRepository.findOne({
      where: { key: 'whatsapp_ai_provider' },
    });
    if (!setting) {
      setting = this.settingsRepository.create({
        key: 'whatsapp_ai_provider',
        scopeUserId: null,
      });
    }
    setting.value = { provider };
    await this.settingsRepository.save(setting);
  }
}
