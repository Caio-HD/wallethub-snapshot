import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_ALERTS } from '../../queues';
import { AlertsService, type NegativeBalanceJobPayload } from './alerts.service';

@Injectable()
@Processor(QUEUE_ALERTS)
export class AlertsProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertsProcessor.name);

  constructor(private readonly alertsService: AlertsService) {
    super();
  }

  async process(job: Job<NegativeBalanceJobPayload>): Promise<void> {
    if (job.name === 'negative-balance') {
      const data = job.data;
      if (!data.organizationId) {
        this.logger.warn('Job negative-balance sem organizationId; ignorado.');
        return;
      }
      await this.alertsService.recordNegativeBalance(data);
      return;
    }
    this.logger.warn(`Job de alerta desconhecido: ${job.name}`);
  }
}
