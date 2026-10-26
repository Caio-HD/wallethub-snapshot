import { IsOptional, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  /** Obrigatória apenas para contas que já possuem uma senha real. */
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(8, { message: 'A nova senha deve ter ao menos 8 caracteres.' })
  newPassword!: string;
}
