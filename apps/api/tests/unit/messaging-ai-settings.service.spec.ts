import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { MessagingAiSettingsService } from '@app/modules/messaging/messaging-ai-settings.service';
import { SettingEntity } from '@app/database/entities/setting.entity';
import { OrganizationEntity } from '@app/database/entities/organization.entity';
import type { ConfigService } from '@nestjs/config';

const ORG_ID = '00000000-0000-0000-0000-000000000001';

const setup = (orgId?: string) => {
  const configService = {
    get: jest.fn().mockReturnValue(orgId ?? null),
  } as unknown as ConfigService;

  const settingsRepository = {
    findOne: jest.fn(),
    create: jest.fn((x: object) => x),
    save: jest.fn(async (x: object) => x),
  } as unknown as Repository<SettingEntity>;

  const organizationRepository = {
    exist: jest.fn().mockResolvedValue(true),
    findOne: jest.fn().mockResolvedValue({ id: ORG_ID }),
  } as unknown as Repository<OrganizationEntity>;

  const service = new MessagingAiSettingsService(
    configService,
    settingsRepository,
    organizationRepository,
  );

  return { service, configService, settingsRepository, organizationRepository };
};

describe('MessagingAiSettingsService', () => {
  describe('getPreferredProvider', () => {
    it('returns provider from settings when found', async () => {
      const { service, settingsRepository } = setup(ORG_ID);
      (settingsRepository.findOne as jest.Mock).mockResolvedValue({
        key: 'whatsapp_ai_provider',
        value: { provider: 'openai' },
      });

      const result = await service.getPreferredProvider();

      expect(result).toBe('openai');
    });

    it('returns undefined when no setting exists', async () => {
      const { service, settingsRepository } = setup(ORG_ID);
      (settingsRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.getPreferredProvider();

      expect(result).toBeUndefined();
    });

    it('returns undefined when no organization exists', async () => {
      const { service, organizationRepository } = setup();
      (organizationRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.getPreferredProvider();

      expect(result).toBeUndefined();
    });

    it('falls back to first org when env org id not found', async () => {
      const { service, organizationRepository, settingsRepository } = setup('nonexistent-org');
      (organizationRepository.exist as jest.Mock).mockResolvedValue(false);
      (organizationRepository.findOne as jest.Mock).mockResolvedValue({ id: ORG_ID });
      (settingsRepository.findOne as jest.Mock).mockResolvedValue({
        value: { provider: 'deepseek' },
      });

      const result = await service.getPreferredProvider();

      expect(result).toBe('deepseek');
    });
  });

  describe('setPreferredProvider', () => {
    it('throws BadRequestException when no organizations exist', async () => {
      const { service, organizationRepository } = setup();
      (organizationRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.setPreferredProvider('openai')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('creates new setting when none exists', async () => {
      const { service, settingsRepository } = setup(ORG_ID);
      (settingsRepository.findOne as jest.Mock).mockResolvedValue(null);
      (settingsRepository.save as jest.Mock).mockResolvedValue({});

      await service.setPreferredProvider('openai');

      expect(settingsRepository.create).toHaveBeenCalled();
      const saved = (settingsRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.value).toEqual({ provider: 'openai' });
    });

    it('updates existing setting', async () => {
      const { service, settingsRepository } = setup(ORG_ID);
      const existing = { key: 'whatsapp_ai_provider', value: { provider: 'openai' } };
      (settingsRepository.findOne as jest.Mock).mockResolvedValue(existing);
      (settingsRepository.save as jest.Mock).mockResolvedValue({});

      await service.setPreferredProvider('deepseek');

      expect(settingsRepository.create).not.toHaveBeenCalled();
      const saved = (settingsRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.value).toEqual({ provider: 'deepseek' });
    });
  });
});
