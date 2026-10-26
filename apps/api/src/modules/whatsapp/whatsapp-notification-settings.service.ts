import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SettingEntity } from '../../database/entities/setting.entity.js';
import {
  DEFAULT_WHATSAPP_NOTIFICATION_PREFERENCES,
  parseWhatsAppNotificationPreferences,
  WHATSAPP_NOTIFICATION_PREFERENCES_KEY,
  type WhatsAppNotificationPreferences,
} from './whatsapp-notification-preferences.js';

@Injectable()
export class WhatsAppNotificationSettingsService {
  constructor(
    @InjectRepository(SettingEntity)
    private readonly settingsRepository: Repository<SettingEntity>,
  ) {}

  async get(organizationId: string): Promise<WhatsAppNotificationPreferences> {
    const setting = await this.settingsRepository.findOne({
      where: { organizationId, key: WHATSAPP_NOTIFICATION_PREFERENCES_KEY, scopeUserId: IsNull() },
    });
    return parseWhatsAppNotificationPreferences(setting?.value);
  }

  async set(
    organizationId: string,
    prefs: WhatsAppNotificationPreferences,
  ): Promise<WhatsAppNotificationPreferences> {
    let setting = await this.settingsRepository.findOne({
      where: { organizationId, key: WHATSAPP_NOTIFICATION_PREFERENCES_KEY, scopeUserId: IsNull() },
    });
    if (!setting) {
      setting = this.settingsRepository.create({
        organizationId,
        key: WHATSAPP_NOTIFICATION_PREFERENCES_KEY,
        scopeUserId: null,
        value: DEFAULT_WHATSAPP_NOTIFICATION_PREFERENCES as unknown as Record<string, unknown>,
      });
    }
    setting.value = prefs as unknown as Record<string, unknown>;
    await this.settingsRepository.save(setting);
    return prefs;
  }
}
