import axios, { type AxiosInstance } from 'axios';
import { type WhatsAppConfig, whatsappWebhookUrl } from '../../core/config/whatsapp.config.js';

export interface EvolutionConnectionStateResponse {
  instance?: { state?: string };
  state?: string;
}

/** Cria um cliente axios pré-configurado para a API do Evolution. */
export function createEvolutionHttp(cfg: WhatsAppConfig): AxiosInstance {
  return axios.create({
    baseURL: cfg.evolutionApiUrl.replace(/\/$/, ''),
    timeout: 30_000,
    headers: { apikey: cfg.evolutionApiKey },
  });
}

export function resolveEvolutionState(data: EvolutionConnectionStateResponse): string {
  return data.instance?.state ?? data.state ?? 'unknown';
}

/** Cria a instância no Evolution já com webhook configurado. */
export async function evolutionCreateInstance(
  http: AxiosInstance,
  cfg: WhatsAppConfig,
  instanceName: string,
  webhookSecret: string,
): Promise<void> {
  const webhookUrl = whatsappWebhookUrl(cfg.publicApiUrl);
  await http.post('/instance/create', {
    instanceName,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: false,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
      headers: { 'X-Webhook-Secret': webhookSecret },
    },
  });
}

/** (Re)configura o webhook de uma instância existente. */
export async function evolutionSetWebhook(
  http: AxiosInstance,
  cfg: WhatsAppConfig,
  instanceName: string,
  webhookSecret: string,
  events: string[],
): Promise<void> {
  const webhookUrl = whatsappWebhookUrl(cfg.publicApiUrl);
  await http.post(`/webhook/set/${instanceName}`, {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      events,
      headers: { 'X-Webhook-Secret': webhookSecret },
    },
  });
}
