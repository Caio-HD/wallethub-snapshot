import { IsIn, IsUUID } from 'class-validator';
import type { OrganizationMembershipRole } from '../../../database/entities/organization-membership.entity';

export class CreatePlatformMembershipDto {
  @IsUUID('4')
  userId!: string;

  @IsIn(['owner', 'admin', 'member'])
  role!: OrganizationMembershipRole;
}
