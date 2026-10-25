import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import type { TransactionTransferLeg } from '../../../database/entities/transaction.entity.js';

/**
 * Transferência (movimento neutro). Dois modos:
 *  - Pareado: `fromAccountId` + `toAccountId` (transferência entre contas próprias) → 2 legs.
 *  - Leg único: `accountId` + `leg` (fatura externa, abertura de saldo, destino não rastreado).
 * O serviço valida que exatamente um dos modos foi informado.
 */
export class CreateTransferDto {
  @IsDateString()
  occurredAt!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  // Modo pareado (entre contas próprias)
  @IsOptional()
  @IsUUID()
  fromAccountId?: string;

  @IsOptional()
  @IsUUID()
  toAccountId?: string;

  // Modo leg único (destino não rastreado)
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsIn(['out', 'in'])
  leg?: TransactionTransferLeg;

  /** Lote de importação de extrato (quando a transferência vem de um OFX) — para auditoria/limpeza. */
  @IsOptional()
  @IsUUID()
  statementImportBatchId?: string;

  /**
   * Identificador da transação no banco de origem (FITID do OFX). Só a importação de extrato
   * preenche: o índice único (account_id, external_id) usa isto para barrar a reimportação.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalId?: string;
}
