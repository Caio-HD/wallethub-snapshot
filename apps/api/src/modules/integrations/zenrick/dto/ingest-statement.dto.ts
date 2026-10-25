import { Type } from 'class-transformer';
import {
  Equals,
  IsBase64,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Contrato v1 do Zenrick Connector — ADR adr-zenrick-connector §3. */

export class IngestStatementFileDto {
  @IsIn(['ofx', 'csv'])
  format!: 'ofx' | 'csv';

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename!: string;

  @IsBase64()
  @IsNotEmpty()
  contentBase64!: string;

  /** sha256 (hex) do conteúdo decodificado — 422 em divergência. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sha256?: string;
}

export class IngestStatementRoutingDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  defaultCategoryId?: string;

  @IsOptional()
  @IsUUID()
  incomeCategoryId?: string;

  @IsOptional()
  @IsUUID()
  expenseCategoryId?: string;
}

export class IngestStatementOptionsDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class IngestStatementProvenanceDto {
  @IsIn(['email'])
  channel!: 'email';

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  extractor!: string;

  /** Hash do message-id do e-mail — nunca o remetente/assunto/corpo (LGPD). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  messageIdHash!: string;

  @IsISO8601()
  receivedAt!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}

export class IngestStatementDto {
  /** Major do contrato — 400 em major desconhecido; mudanças aditivas mantêm 1. */
  @Equals(1)
  schemaVersion!: 1;

  @IsUUID()
  organizationId!: string;

  @ValidateNested()
  @Type(() => IngestStatementFileDto)
  file!: IngestStatementFileDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => IngestStatementRoutingDto)
  routing?: IngestStatementRoutingDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => IngestStatementOptionsDto)
  options?: IngestStatementOptionsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => IngestStatementProvenanceDto)
  provenance!: IngestStatementProvenanceDto;
}
