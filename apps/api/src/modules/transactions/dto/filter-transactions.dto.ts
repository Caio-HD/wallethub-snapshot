import { IsOptional, IsUUID } from 'class-validator';

export class FilterTransactionsDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  /**
   * Âmbito por titular de categoria: omitir = todas as transações;
   * UUID = categorias partilhadas (owner_user_id NULL) ou do utilizador indicado.
   */
  @IsOptional()
  @IsUUID()
  scopeUserId?: string;

  @IsOptional()
  range?: { start?: Date; end?: Date };
}
