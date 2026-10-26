import { Column, Entity, OneToMany, Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { InvestmentMovementEntity } from './investment-movement.entity.js';
import { InvestmentQuoteSnapshotEntity } from './investment-quote-snapshot.entity.js';

export type InvestmentMarket = 'BR' | 'INTL';
export type InvestmentInstrumentKind = 'stock' | 'fii' | 'etf' | 'fixed_income' | 'other';

@Entity({ name: 'investment_instruments' })
export class InvestmentInstrumentEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 32 })
  symbol!: string;

  @Column({ type: 'enum', enum: ['BR', 'INTL'], enumName: 'investment_market_enum' })
  market!: InvestmentMarket;

  @Column({
    type: 'enum',
    enum: ['stock', 'fii', 'etf', 'fixed_income', 'other'],
    enumName: 'investment_instrument_kind_enum',
    default: 'stock',
  })
  kind!: InvestmentInstrumentKind;

  @Column({ type: 'varchar', length: 8, default: 'BRL' })
  currency!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 128, nullable: true })
  displayName?: string | null;

  /** Símbolo na fonte de cotação (ex.: aapl.us no Stooq). BR: igual a symbol. */
  @Column({ name: 'quote_symbol', type: 'varchar', length: 64, nullable: true })
  quoteSymbol?: string | null;

  @OneToMany(() => InvestmentMovementEntity, (m) => m.instrument)
  movements!: Relation<InvestmentMovementEntity>[];

  @OneToMany(() => InvestmentQuoteSnapshotEntity, (q) => q.instrument)
  quoteSnapshots!: Relation<InvestmentQuoteSnapshotEntity>[];
}
