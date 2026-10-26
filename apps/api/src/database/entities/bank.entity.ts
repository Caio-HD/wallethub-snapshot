import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';

/**
 * Catálogo de bancos brasileiros (participantes COMPE/STR).
 * Fonte: lista oficial do Banco Central (STR/SPI/PIX). Usado para identificar o
 * banco a partir do BANKID do OFX e para o seletor no cadastro manual de conta.
 */
@Entity({ name: 'banks' })
export class BankEntity extends BaseEntity {
  /** Código COMPE (3 dígitos, zero-padded). Único. Casa com OFX BANKID. */
  @Column({ name: 'compe_code', type: 'varchar', length: 3, unique: true })
  @Index()
  compeCode!: string;

  /** ISPB (8 dígitos) — identificador do participante no SPB. */
  @Column({ name: 'ispb', type: 'varchar', length: 8, nullable: true })
  ispb!: string | null;

  /** Nome/razão social do banco. */
  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  /** Nome reduzido (como aparece em extratos). */
  @Column({ name: 'short_name', type: 'varchar', length: 120, nullable: true })
  shortName!: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
