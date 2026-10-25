import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SettingEntity } from '../../database/entities/setting.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';

const SETTINGS_KEY = 'whatsapp_ai_provider';

/**
 * Fornecedor de IA partilhado entre canais de mensagens (WhatsApp, Telegram).
 * Persistência em `settings` (mesma chave histórica `whatsapp_ai_provider`).
 */
@Injectable()
export class MessagingAiSettingsService {
  private readonly logger = new Logger(MessagingAiSettingsService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SettingEntity)
    private readonly settingsRepository: Repository<SettingEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
  ) {}

  private async resolveSettingsOrganizationId(): Promise<string | null> {
    const fromEnv = this.configService.get<string>('WHATSAPP_AI_SETTINGS_ORGANIZATION_ID')?.trim();
    if (fromEnv) {
      const exists = await this.organizationRepository.exist({ where: { id: fromEnv } });
      if (exists) return fromEnv;
      this.logger.warn(
        `WHATSAPP_AI_SETTINGS_ORGANIZATION_ID=${fromEnv} não corresponde a nenhuma organização; a usar a primeira org.`,
      );
    }
    const first = await this.organizationRepository.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });
    return first?.id ?? null;
  }

  async getPreferredProvider(): Promise<string | undefined> {
    const organizationId = await this.resolveSettingsOrganizationId();
    if (!organizationId) return undefined;
    const setting = await this.settingsRepository.findOne({
      where: { key: SETTINGS_KEY, organizationId, scopeUserId: IsNull() },
    });
    return (setting?.value?.provider as string) || undefined;
  }

  async setPreferredProvider(provider: string): Promise<void> {
    const organizationId = await this.resolveSettingsOrganizationId();
    if (!organizationId) {
      throw new BadRequestException(
        'Sem organizações: não é possível gravar o fornecedor de IA para mensagens.',
      );
    }
    let setting = await this.settingsRepository.findOne({
      where: { key: SETTINGS_KEY, organizationId, scopeUserId: IsNull() },
    });
    if (!setting) {
      setting = this.settingsRepository.create({
        organizationId,
        key: SETTINGS_KEY,
        scopeUserId: null,
      });
    }
    setting.value = { provider };
    await this.settingsRepository.save(setting);
  }
}
