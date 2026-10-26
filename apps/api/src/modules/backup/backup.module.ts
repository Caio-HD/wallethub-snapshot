import { Module } from '@nestjs/common';
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { BackupMetricsService } from './backup-metrics.service';
import { BackupController } from './backup.controller';

@Module({
  providers: [
    makeGaugeProvider({
      name: 'wallethub_backup_last_success_seconds',
      help: 'Timestamp (Unix epoch em segundos) do último backup bem-sucedido',
      labelNames: [],
    }),
    BackupMetricsService,
  ],
  controllers: [BackupController],
  exports: [BackupMetricsService],
})
export class BackupModule {}
