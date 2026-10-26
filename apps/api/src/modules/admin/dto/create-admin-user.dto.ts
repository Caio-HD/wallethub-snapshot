import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { Role } from '../../../common/decorators/roles.decorator';

export class CreateAdminUserDto {
  @IsString()
  @MinLength(2)
  username!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  phoneNumber?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  /** Only a super_admin actor may set 'super_admin' (enforced in the service). */
  @IsOptional()
  @IsIn(['admin', 'super_admin'])
  role?: Role;
}
