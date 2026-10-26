import { Injectable, Logger } from '@nestjs/common';
import { Gauge } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class BackupMetricsService {
  private readonly logger = new Logger(BackupMetricsService.name);
  private lastSuccessSeconds: number | null = null;

  constructor(
    @InjectMetric('wallethub_backup_last_success_seconds')
    private readonly backupLastSuccess: Gauge<string>,
  ) {}

  /**
   * Atualiza a métrica com o timestamp do último backup bem-sucedido
   * @param timestamp Timestamp em segundos (Unix epoch)
   */
  recordBackupSuccess(timestamp?: number): void {
    const timestampSeconds = timestamp ?? Math.floor(Date.now() / 1000);
    this.lastSuccessSeconds = timestampSeconds;
    this.backupLastSuccess.set(timestampSeconds);
    this.logger.debug(
      `Métrica de backup atualizada: ${timestampSeconds} (${new Date(timestampSeconds * 1000).toISOString()})`,
    );
  }

  /**
   * Obtém o timestamp do último backup bem-sucedido
   * @returns Timestamp em segundos ou null se nunca houve backup
   */
  getLastBackupTimestamp(): number | null {
    return this.lastSuccessSeconds != null && this.lastSuccessSeconds > 0
      ? this.lastSuccessSeconds
      : null;
  }
}
