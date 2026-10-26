import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TransactionSource } from '../../../database/entities/transaction.entity.js';

export class CreateTransactionDto {
  @IsDateString()
  occurredAt!: string;

  @IsUUID()
  accountId!: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalId?: string;

  @IsOptional()
  @IsUUID()
  statementImportBatchId?: string;

  @IsOptional()
  @IsIn(['web', 'whatsapp', 'telegram', 'connector'])
  source?: TransactionSource;

  @IsOptional()
  @IsUUID()
  whatsappEventId?: string;

  @IsOptional()
  @IsUUID()
  telegramEventId?: string;
}
