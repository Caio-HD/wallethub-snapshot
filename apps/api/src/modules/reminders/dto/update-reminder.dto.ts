import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ReminderRecurrence } from '../../../database/entities/reminder.entity';

export class UpdateReminderDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  title?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsEnum(['none', 'monthly'] as const)
  recurrence?: ReminderRecurrence;
}
