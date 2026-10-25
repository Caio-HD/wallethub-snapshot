import { registerAs } from '@nestjs/config';

export interface WhatsAppConfig {
  evolutionApiUrl: string;
  evolutionApiKey: string;
  evolutionInstanceName: string;
  /** URL pública da API (base) usada para montar a URL de webhook do Evolution. */
  publicApiUrl: string;
  /** Instância Evolution dedicada a alertas/dev (ex.: SolidSelect). */
  devInstanceName?: string;
  /** Segredo opcional para validar webhooks da instância dev. */
  devWebhookSecret?: string;
  /** Telefones (E.164, CSV) que recebem alertas internos de dev. */
  devAlertPhones: string[];
  /** Liga os alertas dev (default: ligado, salvo EVOLUTION_DEV_ENABLED=false). */
  devEnabled: boolean;
}

export const whatsappConfig = registerAs('whatsapp', (): WhatsAppConfig => ({
  evolutionApiUrl: process.env.EVOLUTION_API_URL ?? 'https://wallethub.example.com',
  evolutionApiKey: process.env.EVOLUTION_API_KEY ?? '',
  evolutionInstanceName: process.env.EVOLUTION_INSTANCE_NAME ?? 'wallethub',
  publicApiUrl:
    process.env.WALLETHUB_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3030/api',
  devInstanceName: process.env.EVOLUTION_DEV_INSTANCE_NAME?.trim() || undefined,
  devWebhookSecret: process.env.EVOLUTION_DEV_WEBHOOK_SECRET?.trim() || undefined,
  devAlertPhones: (process.env.EVOLUTION_DEV_ALERT_PHONES ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean),
  devEnabled: process.env.EVOLUTION_DEV_ENABLED !== 'false',
}));

/** Monta a URL de webhook do Evolution a partir da base pública da API. */
export function whatsappWebhookUrl(publicApiUrl: string): string {
  const base = publicApiUrl.replace(/\/$/, '');
  return `${base}/whatsapp/webhook`;
}

export function toWhatsAppPublicConfig(c: WhatsAppConfig | undefined) {
  return {
    instanceName: c?.evolutionInstanceName ?? 'wallethub',
    apiUrl: c?.evolutionApiUrl ?? 'https://wallethub.example.com',
  };
}
