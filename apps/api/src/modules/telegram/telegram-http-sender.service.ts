import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TelegramConfig } from '../../core/config/telegram.config';
import { TelegramObservabilityService } from './telegram-observability.service';

@Injectable()
export class TelegramHttpSenderService {
  private readonly logger = new Logger(TelegramHttpSenderService.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly observability?: TelegramObservabilityService,
  ) {}

  async sendMessage(chatId: string, text: string): Promise<void> {
    const cfg = this.configService.get<TelegramConfig>('telegram');
    const token = cfg?.botToken;
    if (!token) {
      this.logger.error('TELEGRAM_BOT_TOKEN em falta; não é possível enviar mensagem.');
      throw new Error('Telegram bot token não configurado.');
    }
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.warn(`sendMessage falhou: ${res.status} ${body}`);
      throw new Error(`Telegram API ${res.status}`);
    }
    this.observability?.recordOutbound();
  }
}
