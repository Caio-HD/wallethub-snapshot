export const WHATSAPP_NOTIFICATION_PREFERENCES_KEY = 'whatsapp_notification_preferences';

export interface WhatsAppNotificationPreferences {
  version: 1;
  dailyDigest: {
    enabled: boolean;
    hourLocal: number;
    timezone: string;
  };
}

export const DEFAULT_WHATSAPP_NOTIFICATION_PREFERENCES: WhatsAppNotificationPreferences = {
  version: 1,
  dailyDigest: {
    enabled: false,
    hourLocal: 8,
    timezone: 'America/Sao_Paulo',
  },
};

export function parseWhatsAppNotificationPreferences(
  raw: unknown,
): WhatsAppNotificationPreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_WHATSAPP_NOTIFICATION_PREFERENCES };
  }
  const r = raw as Record<string, unknown>;
  const digest = r.dailyDigest as Record<string, unknown> | undefined;
  const hourLocal =
    typeof digest?.hourLocal === 'number' && digest.hourLocal >= 0 && digest.hourLocal <= 23
      ? digest.hourLocal
      : DEFAULT_WHATSAPP_NOTIFICATION_PREFERENCES.dailyDigest.hourLocal;
  const timezone =
    typeof digest?.timezone === 'string' && digest.timezone.length > 0
      ? digest.timezone
      : DEFAULT_WHATSAPP_NOTIFICATION_PREFERENCES.dailyDigest.timezone;
  return {
    version: 1,
    dailyDigest: { enabled: Boolean(digest?.enabled), hourLocal, timezone },
  };
}
