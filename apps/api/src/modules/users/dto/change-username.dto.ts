import { Matches } from 'class-validator';

export class ChangeUsernameDto {
  /** 3–30 chars, minúsculas, dígitos e underscore. Normalizado p/ lowercase no serviço. */
  @Matches(/^[a-z0-9_]{3,30}$/, {
    message: 'O username deve ter 3 a 30 caracteres: letras minúsculas, números ou _.',
  })
  username!: string;
}
