import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { QUEUE_TELEGRAM_OUTBOUND } from '../../queues';
import { TelegramHttpSenderService } from './telegram-http-sender.service';

interface OutboundPayload {
  chatId: string;
  body: string;
}

@Injectable()
@Processor(QUEUE_TELEGRAM_OUTBOUND)
export class TelegramDispatcherProcessor extends WorkerHost {
  private readonly logger = new Logger(TelegramDispatcherProcessor.name);

  constructor(private readonly httpSender: TelegramHttpSenderService) {
    super();
  }

  async process(job: Job<OutboundPayload>): Promise<void> {
    const { chatId, body } = job.data;
    try {
      await this.httpSender.sendMessage(chatId, body);
    } catch (e) {
      this.logger.error('Falha ao enviar mensagem Telegram', e as Error);
      throw e;
    }
  }
}
