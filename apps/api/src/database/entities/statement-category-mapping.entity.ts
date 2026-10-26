import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';

/**
 * Mapeamento persistente descrição→categoria por organização. Usado para
 * pré-classificar linhas de importação OFX/CSV automaticamente a partir de
 * importações anteriores. A chave `descriptionKey` é a descrição normalizada
 * (lower, sem acentos, colapsada) — ver normalizeDescriptionKey.
 */
@Entity({ name: 'statement_category_mappings' })
@Index('UQ_scm_org_desc', ['organizationId', 'descriptionKey'], { unique: true })
export class StatementCategoryMappingEntity extends BaseEntity {
  @Column({ name: 'organization_id' })
  @Index()
  organizationId!: string;

  /** Descrição normalizada (chave de match). */
  @Column({ name: 'description_key', type: 'varchar', length: 200 })
  descriptionKey!: string;

  /** Descrição original (exibição) representativa do mapeamento. */
  @Column({ name: 'description_sample', type: 'varchar', length: 255 })
  descriptionSample!: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;
}
