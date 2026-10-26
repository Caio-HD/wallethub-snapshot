import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { TelegramService } from './telegram.service';
import { QUEUE_TELEGRAM_INBOUND } from '../../queues';
import {
  WalletInboundMessagingService,
  type WalletMessagingSink,
} from '../messaging/wallet-inbound-messaging.service';

interface InboundJobPayload {
  eventId: string;
  chatId: string;
  telegramUserId: string;
  text: string;
}

@Injectable()
@Processor(QUEUE_TELEGRAM_INBOUND)
export class TelegramWorkerService extends WorkerHost {
  private readonly logger = new Logger(TelegramWorkerService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
    private readonly telegramService: TelegramService,
    private readonly walletInbound: WalletInboundMessagingService,
  ) {
    super();
  }

  async process(job: Job<InboundJobPayload>) {
    const { eventId, chatId, telegramUserId, text } = job.data;

    const sink: WalletMessagingSink = {
      markProcessed: (id) => this.telegramService.markProcessed(id),
      markFailed: (id, reason) => this.telegramService.markFailed(id, reason),
      enqueueOutbound: (to, body) => this.telegramService.enqueueOutbound(to, body),
    };

    const user = await this.usersService.findByTelegramUserId(telegramUserId);
    if (!user) {
      await this.telegramService.markFailed(eventId, 'Utilizador não autorizado');
      await this.telegramService.enqueueOutbound(chatId, 'Conta não autorizada.');
      return;
    }

    const org = await this.organizationsService.resolveActiveOrganization(user.id, undefined);

    try {
      await this.walletInbound.processTextCommand({
        channel: 'telegram',
        sink,
        eventId,
        replyTo: chatId,
        text,
        userId: user.id,
        org,
      });
    } catch (error) {
      this.logger.error('Erro ao processar comando Telegram', error as Error);
      throw error;
    }
  }
}
