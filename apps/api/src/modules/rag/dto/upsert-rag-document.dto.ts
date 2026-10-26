import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertRagDocumentDto {
  @IsString()
  @MinLength(1)
  sourceKey!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
