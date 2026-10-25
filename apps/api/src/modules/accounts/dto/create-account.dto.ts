import { IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsUUID(undefined, { each: true })
  ownerUserIds?: string[] | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  balance?: number;

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
