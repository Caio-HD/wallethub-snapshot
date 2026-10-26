import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettingEntity } from '../../database/entities/platform-setting.entity';

/**
 * Acesso genérico à configuração global da plataforma (key/value JSON).
 * Escopo único — uma linha por `key`. Mutável em runtime (via console admin).
 */
@Injectable()
export class PlatformSettingsService {
  constructor(
    @InjectRepository(PlatformSettingEntity)
    private readonly repository: Repository<PlatformSettingEntity>,
  ) {}

  async get<T extends Record<string, unknown>>(key: string): Promise<T | undefined> {
    const row = await this.repository.findOne({ where: { key } });
    return row?.value as T | undefined;
  }

  async set<T extends Record<string, unknown>>(key: string, value: T): Promise<T> {
    let row = await this.repository.findOne({ where: { key } });
    if (!row) {
      row = this.repository.create({ key });
    }
    row.value = value;
    await this.repository.save(row);
    return value;
  }
}
