import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type {
  OrganizationPlan,
  OrganizationTaxIdType,
} from '../../../database/entities/organization.entity';

export class PatchPlatformOrganizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsIn(['free', 'pro', 'plus'])
  plan?: OrganizationPlan;

  @IsOptional()
  @IsBoolean()
  isQa?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  legalName?: string | null;

  @IsOptional()
  @IsIn(['cpf', 'cnpj'])
  taxIdType?: OrganizationTaxIdType | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  taxId?: string | null;
}
