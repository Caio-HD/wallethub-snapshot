import { IsOptional, IsUUID } from 'class-validator';

export class RecalculateDashboardDto {
  @IsOptional()
  @IsUUID()
  userId?: string;
}
