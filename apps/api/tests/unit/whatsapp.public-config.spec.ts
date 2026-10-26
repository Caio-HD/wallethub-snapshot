import {
  toWhatsAppPublicConfig,
  type WhatsAppConfig,
} from '../../src/core/config/whatsapp.config';

describe('toWhatsAppPublicConfig', () => {
  it('mapeia config completa', () => {
    const c: WhatsAppConfig = {
      evolutionApiUrl: 'https://evolution.example.com',
      evolutionApiKey: 'secret',
      evolutionInstanceName: 'my-instance',
      publicApiUrl: 'https://api.example.com',
      devAlertPhones: [],
      devEnabled: true,
    };
    expect(toWhatsAppPublicConfig(c)).toEqual({
      instanceName: 'my-instance',
      apiUrl: 'https://evolution.example.com',
    });
  });

  it('aplica defaults quando undefined', () => {
    expect(toWhatsAppPublicConfig(undefined)).toEqual({
      instanceName: 'wallethub',
      apiUrl: 'https://wallethub.example.com',
    });
  });
});
