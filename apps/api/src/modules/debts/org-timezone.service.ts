import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SettingEntity } from '../../database/entities/setting.entity.js';
import {
  DEFAULT_WHATSAPP_NOTIFICATION_PREFERENCES,
  parseWhatsAppNotificationPreferences,
  WHATSAPP_NOTIFICATION_PREFERENCES_KEY,
} from '../whatsapp/whatsapp-notification-preferences.js';

@Injectable()
export class OrgTimezoneService {
  constructor(
    @InjectRepository(SettingEntity)
    private readonly settingsRepository: Repository<SettingEntity>,
  ) {}

  async resolve(organizationId: string): Promise<string> {
    const setting = await this.settingsRepository.findOne({
      where: {
        organizationId,
        key: WHATSAPP_NOTIFICATION_PREFERENCES_KEY,
        scopeUserId: IsNull(),
      },
    });
    return (
      parseWhatsAppNotificationPreferences(setting?.value).dailyDigest.timezone ??
      DEFAULT_WHATSAPP_NOTIFICATION_PREFERENCES.dailyDigest.timezone
    );
  }

  /** Data yyyy-MM-dd no fuso IANA da organização. */
  todayYmdInTimezone(timezone: string, now = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }
}
