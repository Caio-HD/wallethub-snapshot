import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RemindersService } from './reminders.service';

@Injectable()
export class RemindersCronService {
  private readonly logger = new Logger(RemindersCronService.name);

  constructor(private readonly remindersService: RemindersService) {}

  /** 00:05 UTC: lembretes do dia geram alertas in-app (sem WhatsApp proactivo). */
  @Cron('5 0 * * *')
  async handleDailyReminders(): Promise<void> {
    try {
      await this.remindersService.processDueReminders();
    } catch (err) {
      this.logger.error('Falha ao processar lembretes diários', err as Error);
    }
  }
}
