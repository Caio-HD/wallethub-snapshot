import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateCategoryBudgetDto {
  @IsUUID()
  categoryId!: string;

  /** Omitir ou `all` = orçamento para todos; caso contrário UUID do utilizador. */
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  @MaxLength(7)
  period!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;
}
