import { IsBoolean, IsInt, IsString, Max, Min } from 'class-validator';

export class PatchWhatsAppNotificationsDto {
  @IsBoolean()
  dailyDigestEnabled!: boolean;

  @IsInt()
  @Min(0)
  @Max(23)
  dailyDigestHourLocal!: number;

  @IsString()
  dailyDigestTimezone!: string;
}
