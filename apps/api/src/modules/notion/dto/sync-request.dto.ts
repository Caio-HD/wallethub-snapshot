import { IsEnum, IsOptional, IsString, IsArray, IsUUID } from 'class-validator';
import { NotionEntityType } from '../notion.types.js';

export class SyncRequestDto {
  @IsEnum(['transaction', 'account', 'category', 'projection'])
  entityType!: NotionEntityType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entityIds?: string[];

  /** Âmbito opcional (UUID) para futuras extensões de sync por titular. */
  @IsOptional()
  @IsUUID()
  userId?: string;
}
