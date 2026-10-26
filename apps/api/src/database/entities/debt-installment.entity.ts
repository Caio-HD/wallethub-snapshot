import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { PgEnumNames } from '../pg-enum-names.js';
import { BaseEntity } from './base.entity.js';
import { DebtEntity } from './debt.entity.js';
import { TransactionEntity } from './transaction.entity.js';

export type DebtInstallmentStatus = 'pending' | 'paid' | 'skipped';

@Entity({ name: 'debt_installments' })
@Index(['debtId', 'sequenceNumber'], { unique: true })
export class DebtInstallmentEntity extends BaseEntity {
  @Column({ name: 'debt_id', type: 'uuid' })
  @Index()
  debtId!: string;

  @ManyToOne(() => DebtEntity, (debt) => debt.installments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debt_id' })
  debt!: Relation<DebtEntity>;

  @Column({ name: 'sequence_number', type: 'int' })
  sequenceNumber!: number;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'paid', 'skipped'],
    enumName: PgEnumNames.debtInstallmentStatus,
    default: 'pending',
  })
  status!: DebtInstallmentStatus;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId!: string | null;

  @ManyToOne(() => TransactionEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'transaction_id' })
  transaction?: Relation<TransactionEntity> | null;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt!: Date | null;
}
