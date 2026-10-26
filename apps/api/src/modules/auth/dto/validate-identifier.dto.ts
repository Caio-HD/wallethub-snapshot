import { IsString, MinLength } from 'class-validator';

export class ValidateIdentifierDto {
  @IsString()
  @MinLength(1)
  identifier!: string;
}
