import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { OrganizationsService } from './organizations.service';
import { ElevatedAccessService } from '../../common/security/elevated-access.service';
import { ActiveOrganizationGuard } from '../../common/guards/active-organization.guard';
import { ActiveOrganization } from '../../common/decorators/active-organization.decorator';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';
import { PatchOrganizationDto } from './dto/patch-organization.dto';
import { PatchMemberMessagingAiDto } from './dto/patch-member-messaging-ai.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly elevatedAccess: ElevatedAccessService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    // Platform operator sees all orgs (for impersonation); regular users see their memberships.
    const elevated = this.elevatedAccess.isElevatedAllowed(user);
    return this.organizationsService.listForUser(user.id, { elevated });
  }

  @Patch('current')
  @UseGuards(ActiveOrganizationGuard)
  patchCurrent(
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Body() dto: PatchOrganizationDto,
  ) {
    return this.organizationsService.updateOrganizationName(user.id, org.id, dto.name);
  }

  @Get('current/members')
  @UseGuards(ActiveOrganizationGuard)
  async listCurrentMembers(
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    await this.organizationsService.assertOrgOwnerOrAdmin(user.id, org.id);
    const members = await this.organizationsService.listMembersWithDetails(org.id);
    const seatInfo = this.organizationsService.getMessagingAiSeatInfo(org.plan);
    return {
      members,
      seatsInUse: members.filter((m) => m.role === 'member' && m.messagingAiEnabled).length,
      seatLimit: seatInfo.limit,
      planLabel: seatInfo.label,
    };
  }

  @Patch('current/members/:userId/messaging-ai')
  @UseGuards(ActiveOrganizationGuard)
  patchMemberMessagingAi(
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) targetUserId: string,
    @Body() dto: PatchMemberMessagingAiDto,
  ) {
    return this.organizationsService.patchMemberMessagingAiEnabled({
      actorUserId: user.id,
      organizationId: org.id,
      plan: org.plan,
      targetUserId,
      enabled: dto.enabled,
    });
  }
}
