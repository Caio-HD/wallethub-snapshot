import { IsString, MinLength } from 'class-validator';

export class ResetPlatformUserPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
}
