import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { InvestmentInstrumentEntity } from './investment-instrument.entity.js';

@Entity({ name: 'investment_quote_snapshots' })
@Index(['instrumentId', 'recordedAt'])
export class InvestmentQuoteSnapshotEntity extends BaseEntity {
  @Column({ name: 'instrument_id', type: 'uuid' })
  instrumentId!: string;

  @ManyToOne(() => InvestmentInstrumentEntity, (i) => i.quoteSnapshots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instrument_id' })
  instrument!: Relation<InvestmentInstrumentEntity>;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt!: Date;

  @Column({ name: 'last_price', type: 'numeric', precision: 24, scale: 8 })
  lastPrice!: string;

  @Column({ type: 'varchar', length: 8 })
  currency!: string;

  @Column({ type: 'varchar', length: 32 })
  source!: string;
}
