import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { DeepPartial, Repository } from 'typeorm';
import { TelegramEventEntity } from '../../database/entities/telegram-event.entity';
import { QUEUE_TELEGRAM_INBOUND, QUEUE_TELEGRAM_OUTBOUND } from '../../queues';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { toTelegramPublicConfig, type TelegramConfig } from '../../core/config/telegram.config';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramHttpSenderService } from './telegram-http-sender.service';
import { TelegramObservabilityService } from './telegram-observability.service';
import type { IncomingHttpHeaders } from 'http';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(TelegramEventEntity)
    private readonly eventsRepository: Repository<TelegramEventEntity>,
    @InjectQueue(QUEUE_TELEGRAM_INBOUND)
    private readonly inboundQueue: Queue,
    @InjectQueue(QUEUE_TELEGRAM_OUTBOUND)
    private readonly outboundQueue: Queue,
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
    private readonly linkService: TelegramLinkService,
    private readonly httpSender: TelegramHttpSenderService,
    private readonly observability: TelegramObservabilityService,
  ) {}

  assertWebhookHeaders(headers: IncomingHttpHeaders): void {
    const cfg = this.configService.get<TelegramConfig>('telegram');
    if (cfg?.webhookSecret) {
      const got = headers['x-telegram-bot-api-secret-token'];
      const expected = cfg.webhookSecret;
      if (got !== expected) {
        throw new UnauthorizedException('Secret token inválido.');
      }
    }
  }

  assertPathToken(pathToken: string): void {
    const expected = this.configService.get<TelegramConfig>('telegram')?.webhookPathToken;
    if (!expected || pathToken !== expected) {
      throw new UnauthorizedException('Webhook não autorizado.');
    }
  }

  getPublicConfig() {
    return toTelegramPublicConfig(this.configService.get<TelegramConfig>('telegram'));
  }

  async getHealth() {
    const [inboundWaiting, inboundActive, outboundWaiting, outboundActive] = await Promise.all([
      this.inboundQueue.getWaitingCount(),
      this.inboundQueue.getActiveCount(),
      this.outboundQueue.getWaitingCount(),
      this.outboundQueue.getActiveCount(),
    ]);
    return {
      inbound: { waiting: inboundWaiting, active: inboundActive },
      outbound: { waiting: outboundWaiting, active: outboundActive },
    };
  }

  async enqueueOutbound(chatId: string, body: string) {
    await this.outboundQueue.add(
      'send-message',
      { chatId, body },
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

  /**
   * Processa update do Telegram (só DM). Respostas imediatas de sistema (link / não autorizado)
   * usam envio directo; fluxo de comandos usa filas.
   */
  async handleUpdate(update: Record<string, unknown>): Promise<void> {
    const msg = update.message as Record<string, unknown> | undefined;
    if (!msg) return;

    const chat = msg.chat as Record<string, unknown> | undefined;
    if (!chat || chat.type !== 'private') return;

    const from = msg.from as Record<string, unknown> | undefined;
    if (!from || from.is_bot === true) return;

    const chatId = String(chat.id);
    const fromUserId = String(from.id);
    const textRaw = typeof msg.text === 'string' ? msg.text : '';
    const updateId = typeof update.update_id === 'number' ? update.update_id : 0;
    const messageId = typeof msg.message_id === 'number' ? msg.message_id : 0;
    const providerMessageId = `${updateId}:${messageId}`;

    if (textRaw.startsWith('/start')) {
      const payload = textRaw.replace(/^\/start\s*/i, '').trim();
      if (payload) {
        try {
          const ok = await this.linkService.tryLinkUserByNonce(fromUserId, payload);
          if (ok) {
            await this.httpSender.sendMessage(
              chatId,
              'Conta WalletHub ligada com sucesso. Pode usar: saldo, receita, despesa, listar, cancelar.',
            );
            return;
          }
          await this.httpSender.sendMessage(
            chatId,
            'Link inválido ou expirado. Gere um novo link no perfil WalletHub.',
          );
          return;
        } catch (e) {
          const err = e as Error;
          await this.httpSender.sendMessage(chatId, err.message.slice(0, 500));
          return;
        }
      }
    }

    const user = await this.usersService.findByTelegramUserId(fromUserId);
    if (!user) {
      await this.httpSender.sendMessage(
        chatId,
        'Conta não autorizada. Inicie sessão no WalletHub e use «Ligar Telegram» no perfil para obter o link.',
      );
      return;
    }

    const org = await this.organizationsService.resolveActiveOrganization(user.id, undefined);

    const existing = await this.eventsRepository.findOne({ where: { providerMessageId } });
    if (existing) return;

    const text = textRaw.trim();
    if (!text) return;

    const partialEvent: DeepPartial<TelegramEventEntity> = {
      organizationId: org.id,
      providerMessageId,
      fromTelegramUserId: fromUserId,
      direction: 'inbound',
      payload: update,
      parsedCommand: text.slice(0, 30),
      status: 'received',
    };
    const event = this.eventsRepository.create(partialEvent);
    const saved = await this.eventsRepository.save(event);

    await this.inboundQueue.add(
      'inbound-message',
      {
        eventId: saved.id,
        chatId,
        telegramUserId: fromUserId,
        text,
      },
      { removeOnComplete: true, removeOnFail: false },
    );
    this.observability.recordInbound();
  }
}
