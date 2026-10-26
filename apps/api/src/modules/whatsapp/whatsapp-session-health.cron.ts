import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsAppSessionEntity } from '../../database/entities/whatsapp-session.entity.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { TenantEvolutionClient } from './tenant-evolution.client.js';
import { WhatsAppNotificationSettingsService } from './whatsapp-notification-settings.service.js';

const DISCONNECT_ALERT_HOURS = 4;
const MS_PER_HOUR = 60 * 60 * 1000;

@Injectable()
export class WhatsAppSessionHealthCron {
  private readonly logger = new Logger(WhatsAppSessionHealthCron.name);

  constructor(
    @InjectRepository(WhatsAppSessionEntity)
    private readonly sessionsRepository: Repository<WhatsAppSessionEntity>,
    private readonly tenantClient: TenantEvolutionClient,
    private readonly alertsService: AlertsService,
    private readonly notificationSettings: WhatsAppNotificationSettingsService,
  ) {}

  @Cron('0 */6 * * *')
  async checkSessions(): Promise<void> {
    const sessions = await this.sessionsRepository.find();
    const now = Date.now();
    for (const session of sessions) {
      if (!session.evolutionInstanceName) continue;
      try {
        const prefs = await this.notificationSettings.get(session.organizationId);
        const digestActive = prefs.dailyDigest.enabled;
        const recentlyConnected =
          session.status === 'connected' ||
          (session.lastConnectedAt != null &&
            now - session.lastConnectedAt.getTime() < 7 * 24 * MS_PER_HOUR);
        if (!digestActive && !recentlyConnected) continue;

        const stateData = await this.tenantClient.getConnectionState(session.evolutionInstanceName);
        const resolved = this.tenantClient.resolveState(stateData);
        const isDown = resolved === 'close' || resolved === 'qrcode';

        if (!isDown) {
          if (session.disconnectedSince) {
            session.disconnectedSince = null;
            session.healthNotifiedAt = null;
            await this.sessionsRepository.save(session);
          }
          continue;
        }

        if (!session.disconnectedSince) {
          session.disconnectedSince = new Date();
          await this.sessionsRepository.save(session);
        }

        const disconnectedMs = now - (session.disconnectedSince?.getTime() ?? now);
        if (disconnectedMs < DISCONNECT_ALERT_HOURS * MS_PER_HOUR) continue;

        const notifiedRecently =
          session.healthNotifiedAt != null &&
          now - session.healthNotifiedAt.getTime() < DISCONNECT_ALERT_HOURS * MS_PER_HOUR;
        if (notifiedRecently) continue;

        await this.alertsService.recordWhatsAppDisconnected(
          session.organizationId,
          'WhatsApp desligado há mais de 4 horas. Reconecte na página de integrações.',
        );
        session.healthNotifiedAt = new Date();
        await this.sessionsRepository.save(session);
      } catch (error) {
        this.logger.warn(
          `Health check falhou para instância ${session.evolutionInstanceName}`,
          error,
        );
      }
    }
  }
}
