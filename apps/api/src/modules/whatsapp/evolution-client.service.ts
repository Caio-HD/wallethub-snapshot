import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { WhatsAppConfig } from '../../core/config/whatsapp.config.js';
import { WhatsAppObservabilityService } from './whatsapp-observability.service.js';

@Injectable()
export class EvolutionClientService {
  private readonly logger = new Logger(EvolutionClientService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly observability: WhatsAppObservabilityService,
  ) {}

  async sendTextMessage(number: string, text: string): Promise<void> {
    const config = this.configService.get<WhatsAppConfig>('whatsapp')!;
    try {
      await axios.post(
        `${config.evolutionApiUrl}/message/sendText/${config.evolutionInstanceName}`,
        { number, text },
        { headers: { apikey: config.evolutionApiKey } },
      );
      this.observability.incrementOutbound();
    } catch (error) {
      this.logger.error(`Falha ao enviar mensagem via Evolution para ${number}`, error as Error);
      throw error;
    }
  }
}
