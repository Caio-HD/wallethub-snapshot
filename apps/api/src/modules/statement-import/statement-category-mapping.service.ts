import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { StatementCategoryMappingEntity } from '../../database/entities/statement-category-mapping.entity.js';
import { normalizeDescriptionKey } from './statement-row-utils';

/**
 * Memória persistente descrição→categoria por organização. Permite pré-classificar
 * importações futuras a partir das categorias escolhidas em importações anteriores.
 */
@Injectable()
export class StatementCategoryMappingService {
  constructor(
    @InjectRepository(StatementCategoryMappingEntity)
    private readonly repo: Repository<StatementCategoryMappingEntity>,
  ) {}

  async list(organizationId: string): Promise<StatementCategoryMappingEntity[]> {
    return this.repo.find({
      where: { organizationId },
      order: { descriptionSample: 'ASC' },
    });
  }

  /** Resolve um mapa descriptionKey→categoryId para um conjunto de descrições. */
  async resolveForDescriptions(
    organizationId: string,
    descriptions: string[],
  ): Promise<Map<string, string>> {
    const keys = Array.from(
      new Set(descriptions.map(normalizeDescriptionKey).filter((k) => k.length > 0)),
    );
    if (keys.length === 0) return new Map();
    const rows = await this.repo.find({
      where: { organizationId, descriptionKey: In(keys) },
    });
    return new Map(rows.map((r) => [r.descriptionKey, r.categoryId]));
  }

  /** Upsert (idempotente) de um mapeamento. Descrição vazia é ignorada. */
  async upsert(
    organizationId: string,
    description: string,
    categoryId: string,
  ): Promise<StatementCategoryMappingEntity | null> {
    const descriptionKey = normalizeDescriptionKey(description);
    if (!descriptionKey) return null;
    const existing = await this.repo.findOne({ where: { organizationId, descriptionKey } });
    if (existing) {
      existing.categoryId = categoryId;
      existing.descriptionSample = description.slice(0, 255);
      return this.repo.save(existing);
    }
    return this.repo.save(
      this.repo.create({
        organizationId,
        descriptionKey,
        descriptionSample: description.slice(0, 255),
        categoryId,
      }),
    );
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.repo.delete({ id, organizationId });
  }
}
