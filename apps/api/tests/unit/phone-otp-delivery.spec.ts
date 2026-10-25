import { ServiceUnavailableException } from '@nestjs/common';
import { PhoneOtpDeliveryService } from '../../src/modules/auth/providers/notification.providers';
import type { NotificationsConfig } from '../../src/core/config/notifications.config';
import type { OtpWhatsAppSettings } from '../../src/modules/auth/providers/otp-channel-settings.service';

function makeConfig(over: Partial<NotificationsConfig> = {}): NotificationsConfig {
  return {
    resendApiKey: '',
    resendFrom: '',
    emailOtpSubject: '',
    emailOtpHtml: '',
    otpTtlMinutes: 5,
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioPhoneNumber: '',
    twilioOtpBody: '',
    frontendOrigin: '',
    useBuiltInOtpEmailTemplate: true,
    evolutionApiUrl: 'https://evolution.example',
    evolutionApiKey: '',
    evolutionOtpInstanceName: '',
    evolutionOtpCapable: false,
    evolutionOtpDevAutoEnabled: false,
    ...over,
  };
}

function build(cfg: NotificationsConfig, wa: OtpWhatsAppSettings) {
  const twilio = { sendOtp: jest.fn().mockResolvedValue(undefined) };
  const evolution = { sendOtp: jest.fn().mockResolvedValue(undefined) };
  const otpSettings = { getWhatsApp: jest.fn().mockResolvedValue(wa) };
  const configService = { get: jest.fn().mockReturnValue(cfg) };
  const service = new PhoneOtpDeliveryService(
    configService as never,
    twilio as never,
    evolution as never,
    otpSettings as never,
  );
  return { service, twilio, evolution };
}

describe('PhoneOtpDeliveryService.deliverOtp', () => {
  it('sem provider habilitado → lança ServiceUnavailable (prod default)', async () => {
    const { service, twilio, evolution } = build(
      makeConfig({ evolutionOtpCapable: true, evolutionOtpInstanceName: 'wallethub' }),
      { enabled: false },
    );
    await expect(service.deliverOtp('+5511999', '123456')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(twilio.sendOtp).not.toHaveBeenCalled();
    expect(evolution.sendOtp).not.toHaveBeenCalled();
  });

  it('WhatsApp habilitado + capaz → usa Evolution com a instância resolvida', async () => {
    const { service, twilio, evolution } = build(
      makeConfig({ evolutionOtpCapable: true, evolutionOtpInstanceName: 'env-inst' }),
      { enabled: true, instanceName: 'wallethub' },
    );
    await service.deliverOtp('+5511999', '123456', { lang: 'pt' });
    expect(evolution.sendOtp).toHaveBeenCalledWith('+5511999', '123456', {
      lang: 'pt',
      instanceName: 'wallethub',
    });
    expect(twilio.sendOtp).not.toHaveBeenCalled();
  });

  it('WhatsApp habilitado sem instanceName no settings → cai na instância da env', async () => {
    const { service, evolution } = build(
      makeConfig({ evolutionOtpCapable: true, evolutionOtpInstanceName: 'env-inst' }),
      { enabled: true },
    );
    await service.deliverOtp('+5511999', '123456');
    expect(evolution.sendOtp).toHaveBeenCalledWith('+5511999', '123456', {
      instanceName: 'env-inst',
    });
  });

  it('WhatsApp habilitado mas incapaz (sem API key/instância) → cai no Twilio se configurado', async () => {
    const { service, twilio, evolution } = build(
      makeConfig({
        evolutionOtpCapable: false,
        twilioAccountSid: 'AC',
        twilioAuthToken: 'tok',
        twilioPhoneNumber: '+1',
      }),
      { enabled: true, instanceName: 'wallethub' },
    );
    await service.deliverOtp('+5511999', '123456');
    expect(twilio.sendOtp).toHaveBeenCalled();
    expect(evolution.sendOtp).not.toHaveBeenCalled();
  });

  it('DEV auto-enable liga o WhatsApp sem toggle no DB', async () => {
    const { service, evolution } = build(
      makeConfig({
        evolutionOtpCapable: true,
        evolutionOtpInstanceName: 'dev-inst',
        evolutionOtpDevAutoEnabled: true,
      }),
      { enabled: false },
    );
    await service.deliverOtp('+5511999', '123456');
    expect(evolution.sendOtp).toHaveBeenCalledWith('+5511999', '123456', {
      instanceName: 'dev-inst',
    });
  });
});
