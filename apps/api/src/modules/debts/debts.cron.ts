import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DebtsService } from './debts.service.js';

@Injectable()
export class DebtsCronService {
  private readonly logger = new Logger(DebtsCronService.name);

  constructor(private readonly debtsService: DebtsService) {}

  /** 00:15 UTC: parcelas a vencer nos próximos 3 dias (fuso da org). */
  @Cron('15 0 * * *')
  async handleDueDebtAlerts(): Promise<void> {
    try {
      await this.debtsService.processDueDebtAlerts();
    } catch (err) {
      this.logger.error('Falha ao processar alertas de dívidas', err as Error);
    }
  }
}
