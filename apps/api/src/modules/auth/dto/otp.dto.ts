import { IsEnum, IsString, MinLength } from 'class-validator';

export enum OtpType {
  EMAIL = 'email',
  PHONE = 'phone',
}

export class RequestOtpDto {
  @IsEnum(OtpType)
  type!: OtpType;

  @IsString()
  @MinLength(1)
  identifier!: string;
}

export class VerifyOtpDto {
  @IsEnum(OtpType)
  type!: OtpType;

  @IsString()
  @MinLength(1)
  identifier!: string;

  @IsString()
  @MinLength(6)
  code!: string;
}
