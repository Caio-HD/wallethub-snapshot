import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import type {
  OrganizationMembershipRole,
  OrganizationMembershipStatus,
} from '../../../database/entities/organization-membership.entity';

export class PatchPlatformMembershipDto {
  @IsOptional()
  @IsIn(['owner', 'admin', 'member'])
  role?: OrganizationMembershipRole;

  @IsOptional()
  @IsIn(['active', 'invited'])
  status?: OrganizationMembershipStatus;

  @IsOptional()
  @IsBoolean()
  messagingAiEnabled?: boolean;
}
