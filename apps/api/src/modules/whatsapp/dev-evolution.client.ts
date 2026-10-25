import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WhatsAppConfig } from '../../core/config/whatsapp.config.js';
import {
  createEvolutionHttp,
  evolutionSetWebhook,
  resolveEvolutionState,
  type EvolutionConnectionStateResponse,
} from './evolution-http.util.js';

/**
 * Cliente da instância Evolution dedicada a alertas internos/dev (ex.: SolidSelect).
 * Envia notificações operacionais para os telefones configurados em EVOLUTION_DEV_ALERT_PHONES.
 */
@Injectable()
export class DevEvolutionClient {
  private readonly logger = new Logger(DevEvolutionClient.name);

  constructor(private readonly configService: ConfigService) {}

  private cfg(): WhatsAppConfig {
    return this.configService.get<WhatsAppConfig>('whatsapp')!;
  }

  getInstanceName(): string | undefined {
    return this.cfg().devInstanceName;
  }

  isConfigured(): boolean {
    const c = this.cfg();
    return Boolean(c.devEnabled && c.devInstanceName && c.devAlertPhones.length > 0);
  }

  validateWebhookSecret(received?: string): boolean {
    const expected = this.cfg().devWebhookSecret;
    if (!expected) return true;
    return received === expected;
  }

  async setDevWebhook(): Promise<void> {
    const c = this.cfg();
    if (!c.devInstanceName || !c.devWebhookSecret) return;
    await evolutionSetWebhook(createEvolutionHttp(c), c, c.devInstanceName, c.devWebhookSecret, [
      'CONNECTION_UPDATE',
      'QRCODE_UPDATED',
    ]);
  }

  async getConnectionState(): Promise<EvolutionConnectionStateResponse | null> {
    const name = this.cfg().devInstanceName;
    if (!name) return null;
    const { data } = await createEvolutionHttp(this.cfg()).get<EvolutionConnectionStateResponse>(
      `/instance/connectionState/${name}`,
    );
    return data;
  }

  resolveState(data: EvolutionConnectionStateResponse): string {
    return resolveEvolutionState(data);
  }

  async connectInstance(): Promise<Record<string, unknown> | null> {
    const name = this.cfg().devInstanceName;
    if (!name) return null;
    const { data } = await createEvolutionHttp(this.cfg()).get<Record<string, unknown>>(
      `/instance/connect/${name}`,
    );
    return data;
  }

  async logoutInstance(): Promise<void> {
    const name = this.cfg().devInstanceName;
    if (!name) return;
    try {
      await createEvolutionHttp(this.cfg()).delete(`/instance/logout/${name}`);
    } catch (error) {
      this.logger.warn('Falha logout instância Dev', error as Error);
    }
  }

  async sendDevText(text: string): Promise<void> {
    const c = this.cfg();
    if (!c.devEnabled || !c.devInstanceName) return;
    const http = createEvolutionHttp(c);
    for (const phone of c.devAlertPhones) {
      try {
        await http.post(`/message/sendText/${c.devInstanceName}`, { number: phone, text });
      } catch (error) {
        this.logger.error(`Falha alerta Dev para ${phone}`, error as Error);
      }
    }
  }
}
