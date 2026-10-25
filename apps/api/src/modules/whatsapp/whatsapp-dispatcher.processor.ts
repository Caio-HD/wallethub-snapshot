import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { QUEUE_WHATSAPP_OUTBOUND } from '../../queues';
import { EvolutionClientService } from './evolution-client.service';

interface OutboundJobPayload {
  to: string;
  body: string;
}

@Injectable()
@Processor(QUEUE_WHATSAPP_OUTBOUND)
export class WhatsAppDispatcherProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsAppDispatcherProcessor.name);

  constructor(private readonly evolutionClient: EvolutionClientService) {
    super();
  }

  async process(job: Job<OutboundJobPayload>): Promise<void> {
    const { to, body } = job.data;
    try {
      await this.evolutionClient.sendTextMessage(to, body);
    } catch (error) {
      this.logger.error(`Falha ao enviar mensagem para ${to}`, error as Error);
      throw error;
    }
  }
}
