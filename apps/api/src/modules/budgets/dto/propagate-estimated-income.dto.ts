import { IsNumber, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class PropagateEstimatedIncomeDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'fromPeriod deve ser yyyy-MM' })
  fromPeriod!: string;

  @IsNumber()
  estimatedAverageIncome!: number;
}
