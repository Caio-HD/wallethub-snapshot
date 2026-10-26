import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActiveOrganization } from '../../common/decorators/active-organization.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { ActiveOrganizationGuard } from '../../common/guards/active-organization.guard.js';
import type { ActiveOrganizationContext } from '../../common/types/active-organization.js';
import type { WhatsAppConfig } from '../../core/config/whatsapp.config.js';
import { toWhatsAppPublicConfig } from '../../core/config/whatsapp.config.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { PatchWhatsAppNotificationsDto } from './dto/patch-whatsapp-notifications.dto.js';
import { WhatsAppNotificationSettingsService } from './whatsapp-notification-settings.service.js';
import { WhatsAppSessionService } from './whatsapp-session.service.js';
import { WhatsAppService } from './whatsapp.service.js';

@Controller('organizations/current/whatsapp')
@UseGuards(JwtAuthGuard, ActiveOrganizationGuard)
export class OrganizationWhatsAppController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly sessionService: WhatsAppSessionService,
    private readonly whatsappService: WhatsAppService,
    private readonly notificationSettings: WhatsAppNotificationSettingsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async getStatus(
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    await this.organizationsService.assertOrgOwnerOrAdmin(user.id, org.id);
    let session = await this.sessionService.findByOrganizationId(org.id);
    if (session?.evolutionInstanceName) {
      session = await this.sessionService.syncConnectionState(session);
    }
    const health = await this.whatsappService.getHealth();
    const prefs = await this.notificationSettings.get(org.id);
    const publicConfig = toWhatsAppPublicConfig(this.configService.get<WhatsAppConfig>('whatsapp'));
    return {
      session: session
        ? {
            status: session.status,
            evolutionInstanceName: session.evolutionInstanceName,
            connectedPhone: session.connectedPhone,
            lastQr: session.lastQr,
            lastConnectedAt: session.lastConnectedAt,
          }
        : null,
      queues: health,
      notificationPreferences: prefs,
      evolution: publicConfig,
    };
  }

  @Post('instance')
  async createInstance(
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    await this.organizationsService.assertOrgOwnerOrAdmin(user.id, org.id);
    const session = await this.sessionService.createInstance(org.id, org.plan);
    return {
      session: { status: session.status, evolutionInstanceName: session.evolutionInstanceName },
    };
  }

  @Post('instance/connect')
  async connectInstance(
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    await this.organizationsService.assertOrgOwnerOrAdmin(user.id, org.id);
    const session = await this.sessionService.connectInstance(org.id, org.plan);
    return {
      session: {
        status: session.status,
        lastQr: session.lastQr,
        evolutionInstanceName: session.evolutionInstanceName,
      },
    };
  }

  @Delete('instance')
  async deleteInstance(
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    await this.organizationsService.assertOrgOwnerOrAdmin(user.id, org.id);
    await this.sessionService.deleteInstance(org.id, org.plan);
    return { success: true };
  }

  @Get('notifications')
  async getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    await this.organizationsService.assertOrgOwnerOrAdmin(user.id, org.id);
    return this.notificationSettings.get(org.id);
  }

  @Patch('notifications')
  async patchNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Body() dto: PatchWhatsAppNotificationsDto,
  ) {
    await this.organizationsService.assertOrgOwnerOrAdmin(user.id, org.id);
    return this.notificationSettings.set(org.id, {
      version: 1,
      dailyDigest: {
        enabled: dto.dailyDigestEnabled,
        hourLocal: dto.dailyDigestHourLocal,
        timezone: dto.dailyDigestTimezone,
      },
    });
  }
}
