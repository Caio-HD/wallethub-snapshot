import { registerAs } from '@nestjs/config';

export type TelegramConfig = {
  botToken: string;
  webhookPathToken: string;
  webhookSecret?: string;
  botUsername?: string;
};

export function toTelegramPublicConfig(config: TelegramConfig | undefined) {
  return {
    botUsername: config?.botUsername ?? null,
    webhookConfigured: Boolean(config?.botToken && config?.webhookPathToken),
    /** Segmento final do URL do webhook (apenas super_admin). */
    webhookPathToken: config?.webhookPathToken || null,
    webhookSecretConfigured: Boolean(config?.webhookSecret),
  };
}

export const telegramConfig = registerAs('telegram', (): TelegramConfig => ({
  botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '',
  webhookPathToken: process.env.TELEGRAM_WEBHOOK_PATH_TOKEN?.trim() ?? '',
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || undefined,
  botUsername: process.env.TELEGRAM_BOT_USERNAME?.trim() || undefined,
}));
