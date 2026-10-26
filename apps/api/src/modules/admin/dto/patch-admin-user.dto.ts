import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { Role } from '../../../common/decorators/roles.decorator';

/** Blank strings from the platform console mean "clear field" — treat as null before validation. */
const emptyToNull = ({ value }: { value: unknown }) => {
  if (value === '' || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

export class PatchAdminUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MinLength(8)
  phoneNumber?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Only a super_admin actor may change role (enforced in the service). */
  @IsOptional()
  @IsIn(['admin', 'super_admin'])
  role?: Role;

  @IsOptional()
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @IsString()
  preferredLanguage?: string | null;
}
