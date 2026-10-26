import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity.js';

export type ConnectorIngestStatus = 'imported' | 'duplicate' | 'failed';

/**
 * Ledger durável da ingestão do Zenrick Connector (ADR adr-zenrick-connector §5).
 * Uma linha por Idempotency-Key por organização: replay devolve a resposta gravada
 * mesmo após o TTL do cache; falhas acumulam attempts (DLQ lógico) e last_error.
 */
@Entity({ name: 'connector_ingest_events' })
@Unique('UQ_cie_org_idempotency_key', ['organizationId', 'idempotencyKey'])
@Index('IX_cie_org_created', ['organizationId', 'createdAt'])
export class ConnectorIngestEventEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey!: string;

  @Column({ name: 'status', type: 'varchar', length: 16 })
  status!: ConnectorIngestStatus;

  @Column({ name: 'attempts', type: 'int', default: 1 })
  attempts!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ name: 'batch_id', type: 'uuid', nullable: true })
  batchId!: string | null;

  /** Resposta devolvida ao cliente — reenviada tal-e-qual em replays. */
  @Column({ name: 'response', type: 'jsonb', nullable: true })
  response!: Record<string, unknown> | null;
}
