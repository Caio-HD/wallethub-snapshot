import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Auto-cadastro de conta a partir da identidade bancária do OFX. Os três campos
 * de identidade são obrigatórios na prática (validado no serviço) — sem eles o
 * índice único parcial permitiria duplicatas.
 */
export class EnsureAccountDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  /** Código COMPE do banco (OFX BANKID). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bankId?: string | null;

  /** Agência (OFX BRANCHID). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  branchNumber?: string | null;

  /** Número da conta (OFX ACCTID). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  accountNumber?: string | null;
}
