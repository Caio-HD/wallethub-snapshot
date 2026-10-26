import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** Atualiza o canal de OTP por WhatsApp (platform_settings › otp_whatsapp). */
export class UpdateOtpWhatsAppDto {
  /** Kill-switch runtime do envio de OTP por WhatsApp/Evolution. */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** Instância Evolution a usar; string vazia limpa (volta ao default da env). */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  instanceName?: string;
}
