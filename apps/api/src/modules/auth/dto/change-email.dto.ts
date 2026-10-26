import { IsEmail, IsString, Length } from 'class-validator';

export class RequestEmailChangeDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  newEmail!: string;
}

export class ConfirmEmailChangeDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  newEmail!: string;

  @IsString()
  @Length(6, 6, { message: 'O código deve ter 6 dígitos.' })
  code!: string;
}
