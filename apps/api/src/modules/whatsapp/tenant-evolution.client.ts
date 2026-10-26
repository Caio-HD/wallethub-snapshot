import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WhatsAppConfig } from '../../core/config/whatsapp.config.js';
import {
  createEvolutionHttp,
  evolutionCreateInstance,
  evolutionSetWebhook,
  resolveEvolutionState,
} from './evolution-http.util.js';

@Injectable()
export class TenantEvolutionClient {
  private readonly logger = new Logger(TenantEvolutionClient.name);

  constructor(private readonly configService: ConfigService) {}

  private cfg(): WhatsAppConfig {
    return this.configService.get<WhatsAppConfig>('whatsapp')!;
  }

  async createInstance(instanceName: string, webhookSecret: string): Promise<void> {
    const http = createEvolutionHttp(this.cfg());
    try {
      await evolutionCreateInstance(http, this.cfg(), instanceName, webhookSecret);
    } catch {
      await evolutionSetWebhook(http, this.cfg(), instanceName, webhookSecret, [
        'MESSAGES_UPSERT',
        'CONNECTION_UPDATE',
        'QRCODE_UPDATED',
      ]);
    }
  }

  async setWebhook(instanceName: string, webhookSecret: string): Promise<void> {
    await evolutionSetWebhook(
      createEvolutionHttp(this.cfg()),
      this.cfg(),
      instanceName,
      webhookSecret,
      ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
    );
  }

  async connectInstance(instanceName: string): Promise<Record<string, unknown>> {
    const { data } = await createEvolutionHttp(this.cfg()).get<Record<string, unknown>>(
      `/instance/connect/${instanceName}`,
    );
    return data;
  }

  async getConnectionState(instanceName: string): Promise<Record<string, unknown>> {
    const { data } = await createEvolutionHttp(this.cfg()).get<Record<string, unknown>>(
      `/instance/connectionState/${instanceName}`,
    );
    return data;
  }

  resolveState(data: Record<string, unknown>): string {
    return resolveEvolutionState(
      data as import('./evolution-http.util.js').EvolutionConnectionStateResponse,
    );
  }

  async deleteInstance(instanceName: string): Promise<void> {
    try {
      await createEvolutionHttp(this.cfg()).delete(`/instance/delete/${instanceName}`);
    } catch (error) {
      this.logger.warn(`Falha ao apagar instância ${instanceName}`, error);
    }
  }

  async logoutInstance(instanceName: string): Promise<void> {
    try {
      await createEvolutionHttp(this.cfg()).delete(`/instance/logout/${instanceName}`);
    } catch (error) {
      this.logger.warn(`Falha logout ${instanceName}`, error);
    }
  }

  async sendText(instanceName: string, number: string, text: string): Promise<void> {
    await createEvolutionHttp(this.cfg()).post(`/message/sendText/${instanceName}`, {
      number,
      text,
    });
  }
}
