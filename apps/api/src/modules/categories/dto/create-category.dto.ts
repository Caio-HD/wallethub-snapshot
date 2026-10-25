import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { CategoryType } from '../../../database/entities/category.entity.js';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(60)
  name!: string;

  @IsIn(['income', 'expense'])
  type!: CategoryType;

  /** Omitir = categoria partilhada (todos). Caso contrário, UUID do titular. */
  @IsOptional()
  @IsUUID()
  ownerUserId?: string | null;

  @IsOptional()
  sortOrder?: number;
}
