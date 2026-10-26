import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { EvolutionApiService } from '../whatsapp/evolution-api.service';
import {
  OtpChannelSettingsService,
  type OtpWhatsAppSettings,
} from '../auth/providers/otp-channel-settings.service';
import type { WhatsAppConfig } from '../../core/config/whatsapp.config';
import type { NotificationsConfig } from '../../core/config/notifications.config';

export interface OtpWhatsAppStatus {
  /** Kill-switch runtime (platform_settings). */
  enabled: boolean;
  /** Instância efetiva (settings › env). */
  instanceName: string;
  /** Tem API key configurada (env) — pré-requisito para enviar. */
  capable: boolean;
  /** Estado do socket WhatsApp: open | connecting | close | unknown | unreachable. */
  connectionState: string;
}

/**
 * Gestão pelo console admin da instância Evolution única usada no OTP por WhatsApp,
 * mais o toggle runtime. Reusa a fachada EvolutionApiService (mesmo servidor do
 * WhatsApp de produto) e o OtpChannelSettingsService (fonte de verdade do liga/desliga).
 */
@Injectable()
export class EvolutionOtpAdminService {
  private readonly logger = new Logger(EvolutionOtpAdminService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly evolution: EvolutionApiService,
    private readonly otpSettings: OtpChannelSettingsService,
  ) {}

  /** Instância efetiva: settings do console › default da env (whatsapp). */
  private async resolveInstanceName(): Promise<string> {
    const wa = await this.otpSettings.getWhatsApp();
    const whatsapp = this.configService.get<WhatsAppConfig>('whatsapp');
    return (wa.instanceName || whatsapp?.evolutionInstanceName || 'wallethub').trim();
  }

  private capable(): boolean {
    return Boolean(
      this.configService.get<NotificationsConfig>('notifications')?.evolutionOtpCapable,
    );
  }

  async getStatus(): Promise<OtpWhatsAppStatus> {
    const wa = await this.otpSettings.getWhatsApp();
    const instanceName = await this.resolveInstanceName();
    const capable = this.capable();
    let connectionState = 'unknown';
    if (capable) {
      try {
        connectionState = this.evolution.resolveState(
          await this.evolution.getConnectionState(instanceName),
        );
      } catch (error) {
        // Instância pode não existir ainda, ou Evolution indisponível — não é erro fatal.
        this.logger.warn(`Estado indisponível para instância '${instanceName}'`, error as Error);
        connectionState = 'unreachable';
      }
    }
    return { enabled: wa.enabled, instanceName, capable, connectionState };
  }

  /** Cria (idempotente) a instância no Evolution. Webhook secret efêmero (OTP é só outbound). */
  async createInstance(): Promise<{ instanceName: string }> {
    const instanceName = await this.resolveInstanceName();
    await this.evolution.createInstance(instanceName, randomUUID());
    return { instanceName };
  }

  /** Retorna o QR (base64/pairing code) para parear a instância. */
  async connect(): Promise<Record<string, unknown>> {
    const instanceName = await this.resolveInstanceName();
    return this.evolution.connectInstance(instanceName);
  }

  async logout(): Promise<{ instanceName: string }> {
    const instanceName = await this.resolveInstanceName();
    await this.evolution.logoutInstance(instanceName);
    return { instanceName };
  }

  getSettings(): Promise<OtpWhatsAppSettings> {
    return this.otpSettings.getWhatsApp();
  }

  setSettings(patch: Partial<OtpWhatsAppSettings>): Promise<OtpWhatsAppSettings> {
    return this.otpSettings.setWhatsApp(patch);
  }
}
