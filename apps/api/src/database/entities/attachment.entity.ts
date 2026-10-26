import { Column, Entity, JoinColumn, OneToOne, Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { TransactionEntity } from './transaction.entity.js';

@Entity({ name: 'attachments' })
export class AttachmentEntity extends BaseEntity {
  @OneToOne(() => TransactionEntity, (transaction) => transaction.attachment, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transaction_id' })
  transaction!: Relation<TransactionEntity>;

  @Column({ name: 'file_name' })
  fileName!: string;

  @Column({ name: 'mime_type' })
  mimeType!: string;

  @Column({ name: 'storage_path' })
  storagePath!: string;
}
