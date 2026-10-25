import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  Relation,
} from 'typeorm';
import { PgEnumNames } from '../pg-enum-names.js';
import { BaseEntity } from './base.entity.js';
import { AccountEntity } from './account.entity.js';
import { CategoryEntity } from './category.entity.js';
import { UserEntity } from './user.entity.js';
import { AttachmentEntity } from './attachment.entity.js';
import { WhatsAppEventEntity } from './whatsapp-event.entity.js';
import { TelegramEventEntity } from './telegram-event.entity.js';
import { TransactionAuditEntity } from './transaction-audit.entity.js';
import { OrganizationEntity } from './organization.entity.js';

export type TransactionDirection = 'income' | 'expense' | 'transfer';
/** Sentido do fluxo de caixa de uma perna de transferência: 'out' debita, 'in' credita. */
export type TransactionTransferLeg = 'out' | 'in';
export type TransactionSource = 'web' | 'whatsapp' | 'telegram' | 'connector';

@Entity({ name: 'transactions' })
@Index(['occurredAt'])
export class TransactionEntity extends BaseEntity {
  @Column({ name: 'occurred_at', type: 'timestamp' })
  occurredAt!: Date;

  @ManyToOne(() => AccountEntity, (account) => account.transactions, { nullable: false })
  @JoinColumn({ name: 'account_id' })
  account!: Relation<AccountEntity>;

  @ManyToOne(() => CategoryEntity, (category) => category.transactions, { nullable: false })
  @JoinColumn({ name: 'category_id' })
  category!: Relation<CategoryEntity>;

  @ManyToOne(() => UserEntity, (user) => user.transactions, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<UserEntity>;

  @Column({ name: 'organization_id' })
  @Index()
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Relation<OrganizationEntity>;

  @Column({
    type: 'enum',
    enum: ['income', 'expense', 'transfer'],
    enumName: PgEnumNames.transactionDirection,
  })
  direction!: TransactionDirection;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  /**
   * Agrupa as pernas (legs) de uma mesma transferência. NULL para income/expense normais.
   * Leg único (fatura externa, abertura de saldo) tem grupo próprio sem contraparte.
   */
  @Column({ name: 'transfer_group_id', type: 'uuid', nullable: true })
  @Index('IX_transactions_transfer_group', { where: '"transfer_group_id" IS NOT NULL' })
  transferGroupId?: string | null;

  /** Sentido do fluxo de caixa do leg ('out' debita o saldo, 'in' credita). NULL se não-transfer. */
  @Column({
    name: 'transfer_leg',
    type: 'enum',
    enum: ['out', 'in'],
    enumName: PgEnumNames.transactionTransferLeg,
    nullable: true,
  })
  transferLeg?: TransactionTransferLeg | null;

  @Column({ nullable: true })
  description?: string;

  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  externalId?: string | null;

  @Column({
    type: 'enum',
    enum: ['web', 'whatsapp', 'telegram', 'connector'],
    enumName: PgEnumNames.transactionSource,
    default: 'web',
  })
  source!: TransactionSource;

  @Column({ name: 'locked_until', type: 'timestamp', nullable: true })
  lockedUntil?: Date;

  /** Lote de importação de extrato que criou esta transação (auditoria OFX/CSV). */
  @Column({ name: 'statement_import_batch_id', type: 'uuid', nullable: true })
  @Index()
  statementImportBatchId?: string | null;

  @OneToOne(() => AttachmentEntity, (attachment) => attachment.transaction)
  attachment?: AttachmentEntity;

  @ManyToOne(() => WhatsAppEventEntity, (event) => event.transactions, { nullable: true })
  @JoinColumn({ name: 'whatsapp_event_id' })
  whatsAppEvent?: WhatsAppEventEntity;

  @ManyToOne(() => TelegramEventEntity, (event) => event.transactions, { nullable: true })
  @JoinColumn({ name: 'telegram_event_id' })
  telegramEvent?: Relation<TelegramEventEntity>;

  @OneToMany(() => TransactionAuditEntity, (audit) => audit.transaction)
  auditLogs!: TransactionAuditEntity[];
}
