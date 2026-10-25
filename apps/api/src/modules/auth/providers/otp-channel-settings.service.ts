import { Injectable } from '@nestjs/common';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';

/** Chave global (platform_settings) do canal de OTP por WhatsApp. */
export const OTP_WHATSAPP_SETTINGS_KEY = 'otp_whatsapp';

export interface OtpWhatsAppSettings {
  /** Kill-switch runtime: envia OTP por WhatsApp/Evolution quando true. Default OFF. */
  enabled: boolean;
  /** Instância Evolution a usar; sobrepõe a env EVOLUTION_OTP_INSTANCE_NAME. */
  instanceName?: string;
}

const DEFAULTS: OtpWhatsAppSettings = { enabled: false };

/**
 * Estado runtime do OTP por WhatsApp, persistido em `platform_settings`.
 * Fonte de verdade do liga/desliga (o console admin escreve aqui) — a env
 * fica só como capability (URL/API key) e como default da instância.
 */
@Injectable()
export class OtpChannelSettingsService {
  constructor(private readonly platformSettings: PlatformSettingsService) {}

  async getWhatsApp(): Promise<OtpWhatsAppSettings> {
    const stored =
      await this.platformSettings.get<Record<string, unknown>>(OTP_WHATSAPP_SETTINGS_KEY);
    if (!stored) return { ...DEFAULTS };
    return {
      enabled: Boolean(stored.enabled),
      instanceName:
        typeof stored.instanceName === 'string' && stored.instanceName.trim()
          ? stored.instanceName.trim()
          : undefined,
    };
  }

  async setWhatsApp(patch: Partial<OtpWhatsAppSettings>): Promise<OtpWhatsAppSettings> {
    const current = await this.getWhatsApp();
    const next: OtpWhatsAppSettings = {
      enabled: patch.enabled ?? current.enabled,
      instanceName:
        patch.instanceName !== undefined
          ? patch.instanceName.trim() || undefined
          : current.instanceName,
    };
    await this.platformSettings.set(OTP_WHATSAPP_SETTINGS_KEY, {
      enabled: next.enabled,
      ...(next.instanceName ? { instanceName: next.instanceName } : {}),
    });
    return next;
  }
}
