import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';
import { InvestmentInstrumentEntity } from './investment-instrument.entity.js';

export type InvestmentMovementKind = 'buy' | 'sell' | 'dividend';

@Entity({ name: 'investment_movements' })
export class InvestmentMovementEntity extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<UserEntity>;

  @Column({ name: 'instrument_id', type: 'uuid' })
  @Index()
  instrumentId!: string;

  @ManyToOne(() => InvestmentInstrumentEntity, (i) => i.movements, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'instrument_id' })
  instrument!: Relation<InvestmentInstrumentEntity>;

  @Column({
    type: 'enum',
    enum: ['buy', 'sell', 'dividend'],
    enumName: 'investment_movement_kind_enum',
  })
  kind!: InvestmentMovementKind;

  @Column({ type: 'numeric', precision: 24, scale: 8, default: 0 })
  quantity!: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 24, scale: 8, default: 0 })
  unitPrice!: string;

  @Column({ type: 'numeric', precision: 24, scale: 8, default: 0 })
  fees!: string;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  @Index()
  occurredAt!: Date;

  @Column({ type: 'varchar', length: 512, nullable: true })
  notes?: string | null;

  /** Conta de caixa de origem/destino do dinheiro (aporte debita, resgate credita). NULL = sem caixa. */
  @Column({ name: 'account_id', type: 'uuid', nullable: true })
  @Index('IX_investment_movements_account', { where: '"account_id" IS NOT NULL' })
  accountId?: string | null;

  /** transfer_group_id da transferência de caixa gerada — para reverter ao apagar o movimento. */
  @Column({ name: 'cash_transfer_group_id', type: 'uuid', nullable: true })
  cashTransferGroupId?: string | null;

  /** Lote de importação de extrato que criou este movimento (RDB detectado no OFX). */
  @Column({ name: 'statement_import_batch_id', type: 'uuid', nullable: true })
  @Index('IX_investment_movements_batch', { where: '"statement_import_batch_id" IS NOT NULL' })
  statementImportBatchId?: string | null;
}
