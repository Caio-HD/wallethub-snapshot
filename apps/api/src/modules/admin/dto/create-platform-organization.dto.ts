import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type {
  OrganizationPlan,
  OrganizationTaxIdType,
} from '../../../database/entities/organization.entity';

export class CreatePlatformOrganizationDto {
  @IsString()
  @MaxLength(128)
  name!: string;

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

  /** Primeiro owner opcional (membership criada na mesma operação). */
  @IsOptional()
  @IsUUID('4')
  ownerUserId?: string;
}
