import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ReminderRecurrence } from '../../../database/entities/reminder.entity';

export class CreateReminderDto {
  @IsString()
  @MaxLength(256)
  title!: string;

  @IsDateString()
  dueAt!: string;

  @IsOptional()
  @IsEnum(['none', 'monthly'] as const)
  recurrence?: ReminderRecurrence;
}
