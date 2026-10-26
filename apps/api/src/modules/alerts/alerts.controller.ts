import { Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveOrganizationGuard } from '../../common/guards/active-organization.guard';
import { ActiveOrganization } from '../../common/decorators/active-organization.decorator';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AlertsService } from './alerts.service';

@Controller('alerts')
@UseGuards(JwtAuthGuard, ActiveOrganizationGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  list(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.alertsService.listForActiveUser(org.id, user.id);
  }

  @Patch(':id/read')
  markRead(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.alertsService.markRead(org.id, user.id, id);
  }
}
