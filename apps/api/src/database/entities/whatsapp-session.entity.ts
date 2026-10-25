import { Column, Entity, Index } from 'typeorm';
import { PgEnumNames } from '../pg-enum-names.js';
import { BaseEntity } from './base.entity.js';

export type WhatsAppSessionStatus = 'unknown' | 'qr' | 'connected' | 'disconnected';

@Entity({ name: 'whatsapp_sessions' })
export class WhatsAppSessionEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'session_name', unique: true })
  @Index()
  sessionName!: string;

  @Column({
    type: 'enum',
    enum: ['unknown', 'qr', 'connected', 'disconnected'],
    enumName: PgEnumNames.whatsappSessionStatus,
    default: 'unknown',
  })
  status!: WhatsAppSessionStatus;

  @Column({ name: 'auth_state', type: 'jsonb', nullable: true })
  authState?: Record<string, unknown> | null;

  @Column({ name: 'last_connected_at', type: 'timestamp', nullable: true })
  lastConnectedAt?: Date | null;

  @Column({ name: 'last_qr', type: 'text', nullable: true })
  lastQr?: string | null;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  // Evolution multi-tenant fields (migration 013)
  @Column({ name: 'evolution_instance_name', type: 'varchar', nullable: true })
  evolutionInstanceName?: string | null;

  @Column({ name: 'webhook_secret', type: 'varchar', nullable: true })
  webhookSecret?: string | null;

  @Column({ name: 'connected_phone', type: 'varchar', nullable: true })
  connectedPhone?: string | null;

  @Column({ name: 'last_sync_at', type: 'timestamp', nullable: true })
  lastSyncAt?: Date | null;

  // Session health fields (migration 014)
  @Column({ name: 'disconnected_since', type: 'timestamp', nullable: true })
  disconnectedSince?: Date | null;

  @Column({ name: 'health_notified_at', type: 'timestamp', nullable: true })
  healthNotifiedAt?: Date | null;
}
