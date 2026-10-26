import { Controller, Post, UseGuards, HttpCode, HttpStatus, Body } from '@nestjs/common';
import { AdminTokenGuard } from '../../common/guards/admin-token.guard';
import { BackupMetricsService } from './backup-metrics.service';

/**
 * Controller para atualizar métricas de backup.
 *
 * Endpoint server-to-server: chamado pelo script de backup após sucesso, autenticado com o
 * token de serviço (`AdminTokenGuard` / `WALLETHUB_ADMIN_TOKEN`) — NÃO com um JWT de utilizador.
 * Antes era `@Roles('admin')`, que (como todo utilizador tem role global 'admin') permitia a
 * qualquer autenticado falsear a métrica de backup. Exemplo:
 *   curl -X POST http://localhost:3000/backup/success -H "Authorization: Bearer $WALLETHUB_ADMIN_TOKEN"
 */
@Controller('backup')
@UseGuards(AdminTokenGuard)
export class BackupController {
  constructor(private readonly backupMetricsService: BackupMetricsService) {}

  @Post('success')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordBackupSuccess(@Body() body?: { timestamp?: number }): void {
    this.backupMetricsService.recordBackupSuccess(body?.timestamp);
  }
}
