import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';

export type StatementImportFormat = 'csv' | 'ofx';

/**
 * Lote de importação de extrato (auditoria OFX/CSV). Agrupa as transações criadas
 * num único commit de importação para permitir listagem e exclusão em bloco.
 * Anti-duplicidade de arquivo: índice único parcial por (organization_id, account_id,
 * file_hash) entre lotes ATIVOS — reimportar o mesmo arquivo é bloqueado enquanto o
 * lote vive; após excluir o lote (soft delete) a reimportação é liberada.
 */
@Entity({ name: 'statement_import_batches' })
@Index('IX_sib_org_created', ['organizationId', 'createdAt'])
export class StatementImportBatchEntity extends BaseEntity {
  @Column({ name: 'organization_id' })
  @Index()
  organizationId!: string;

  @Column({ name: 'account_id', type: 'uuid' })
  @Index()
  accountId!: string;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @Column({ name: 'filename', type: 'varchar', length: 255 })
  filename!: string;

  @Column({
    name: 'format',
    type: 'enum',
    enum: ['csv', 'ofx'],
    enumName: 'statement_import_format',
  })
  format!: StatementImportFormat;

  /** sha256 (hex, 64) do buffer do arquivo — chave de dedup em nível de arquivo. */
  @Column({ name: 'file_hash', type: 'varchar', length: 64 })
  fileHash!: string;

  /** BANKID (COMPE) detectado no OFX, quando houver. */
  @Column({ name: 'detected_bank_id', type: 'varchar', length: 20, nullable: true })
  detectedBankId!: string | null;

  @Column({ name: 'transaction_count', type: 'int', default: 0 })
  transactionCount!: number;

  @Column({ name: 'skipped_count', type: 'int', default: 0 })
  skippedCount!: number;

  /** Canal que originou o lote: 'web' (UI) ou 'connector' (ingestão S2S Zenrick). */
  @Column({ name: 'origin', type: 'varchar', length: 20, default: 'web' })
  origin!: 'web' | 'connector';

  /**
   * Metadados da origem externa (extractor, messageIdHash, receivedAt) — nunca
   * remetente/assunto/corpo de e-mail (LGPD). Ver ADR adr-zenrick-connector.
   */
  @Column({ name: 'provenance', type: 'jsonb', nullable: true })
  provenance!: Record<string, unknown> | null;
}
