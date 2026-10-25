import { Type } from 'class-transformer';
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
import type { InvestmentInstrumentKind } from '../../../database/entities/investment-instrument.entity';
import type { InvestmentMarket } from '../../../database/entities/investment-instrument.entity';
import type { InvestmentMovementKind } from '../../../database/entities/investment-movement.entity';

const MARKETS = ['BR', 'INTL'] as const;
const INSTR_KINDS = ['stock', 'fii', 'etf', 'fixed_income', 'other'] as const;
const MOV_KINDS = ['buy', 'sell', 'dividend'] as const;

export class CreateInvestmentMovementDto {
  @IsString()
  @MaxLength(32)
  symbol!: string;

  @IsIn(MARKETS)
  market!: InvestmentMarket;

  @IsIn(INSTR_KINDS)
  kind!: InvestmentInstrumentKind;

  @IsIn(MOV_KINDS)
  movementKind!: InvestmentMovementKind;

  // Renda variável: quantity + unitPrice. Renda fixa: usar `amount` (principal/rendimento).
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0)
  unitPrice?: number;

  /** Renda fixa (RDB/CDB): valor em dinheiro do aporte/resgate/rendimento (sem cotação). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  /** Conta de caixa: se informada, aporte debita e resgate credita o saldo (transferência neutra). */
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0)
  fees?: number;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  quoteSymbol?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  displayName?: string;
}
