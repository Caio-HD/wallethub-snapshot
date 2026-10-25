import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';

/**
 * Configuração global da plataforma (super-admin), mutável em runtime.
 * Diferente de `settings` (SettingEntity), que é por organização — aqui o
 * escopo é único/global (uma linha por `key`). Persistir em DB em vez de env
 * permite gerir pelo console e evita depender de redeploy.
 */
@Entity({ name: 'platform_settings' })
export class PlatformSettingEntity extends BaseEntity {
  @Column({ unique: true })
  @Index({ unique: true })
  key!: string;

  @Column({ type: 'jsonb' })
  value!: Record<string, unknown>;
}
