import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ElevatedAccessGuard } from '../../common/security/elevated-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AdminPlatformService, platformAuditItemsToCsv } from './admin-platform.service';
import { AdminUsersService } from './admin-users.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformAudit } from './platform-audit.decorator';
import { PatchPlatformOrganizationDto } from './dto/patch-platform-organization.dto';
import { CreatePlatformOrganizationDto } from './dto/create-platform-organization.dto';
import { CreatePlatformMembershipDto } from './dto/create-platform-membership.dto';
import { PatchPlatformMembershipDto } from './dto/patch-platform-membership.dto';
import { PatchAdminUserDto } from './dto/patch-admin-user.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ResetPlatformUserPasswordDto } from './dto/reset-platform-user-password.dto';
import { PlatformImpersonateDto } from './dto/platform-impersonate.dto';
import type { UserEntity } from '../../database/entities/user.entity';

/**
 * Platform console (super_admin only). Layers, in order:
 *   JwtAuthGuard → RolesGuard('super_admin') → ElevatedAccessGuard (kill-switch + MFA).
 */
@Controller('admin/platform')
@UseGuards(JwtAuthGuard, RolesGuard, ElevatedAccessGuard)
@Roles('super_admin')
export class AdminPlatformController {
  constructor(
    private readonly platform: AdminPlatformService,
    private readonly adminUsers: AdminUsersService,
    private readonly audit: PlatformAuditService,
  ) {}

  @Get('organizations')
  listOrganizations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('plan') plan?: string,
  ) {
    return this.platform.listOrganizations(user.id, { page, limit, q, plan });
  }

  @Post('organizations')
  @PlatformAudit({ action: 'create', entityType: 'organization' })
  createOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePlatformOrganizationDto,
  ) {
    return this.platform.createOrganization(user.id, dto);
  }

  @Get('organizations/:id')
  getOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.platform.getOrganizationDetail(user.id, id);
  }

  @Get('organizations/:id/transactions')
  listOrgTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
  ) {
    return this.platform.listOrgTransactions(user.id, id, { page, limit, from, to, q });
  }

  @Get('organizations/:id/accounts')
  listOrgAccounts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.platform.listOrgAccounts(user.id, id);
  }

  @Get('organizations/:id/categories')
  listOrgCategories(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.platform.listOrgCategories(user.id, id);
  }

  @Patch('organizations/:id')
  @PlatformAudit({ action: 'update', entityType: 'organization' })
  patchOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: PatchPlatformOrganizationDto,
  ) {
    return this.platform.patchOrganization(user.id, id, dto);
  }

  @Post('organizations/:id/members')
  @PlatformAudit({ action: 'create', entityType: 'organization_membership' })
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreatePlatformMembershipDto,
  ) {
    return this.platform.addMember(user.id, id, dto);
  }

  @Patch('organizations/:orgId/members/:userId')
  @PlatformAudit({ action: 'update', entityType: 'organization_membership' })
  patchMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: PatchPlatformMembershipDto,
  ) {
    return this.platform.patchMember(user.id, orgId, userId, dto);
  }

  @Delete('organizations/:orgId/members/:userId')
  @PlatformAudit({ action: 'deactivate', entityType: 'organization_membership' })
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ) {
    return this.platform.removeMember(user.id, orgId, userId);
  }

  // Canonical, audited operator surface for users (consolidates the legacy /admin/users routes).
  @Get('users')
  async listUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('q') q?: string,
  ) {
    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw ?? '20', 10) || 20));
    const { items, total } = await this.adminUsers.list({ page, limit, q });
    await this.audit.record({
      actorUserId: user.id,
      action: 'read',
      entityType: 'user',
      query: { page, limit, q: q ?? null, count: items.length, total },
    });
    return {
      items: await Promise.all(items.map((u) => this.adminUsers.toPublic(u))),
      total,
      page,
      limit,
    };
  }

  @Post('users')
  @PlatformAudit({ action: 'create', entityType: 'user' })
  async createUser(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAdminUserDto) {
    return this.audit.auditedMutation(
      {
        actorUserId: user.id,
        action: 'create',
        entityType: 'user',
        entityId: (u) => (u as UserEntity).id,
      },
      () => Promise.resolve(null),
      () => this.adminUsers.create(dto, user.role),
      (u) => this.adminUsers.toPublic(u as UserEntity) as Promise<Record<string, unknown>>,
    );
  }

  @Get('users/:id')
  async getUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const target = await this.adminUsers.findOne(id);
    const result = await this.adminUsers.toPublic(target);
    await this.audit.record({
      actorUserId: user.id,
      action: 'read',
      entityType: 'user',
      entityId: id,
    });
    return result;
  }

  @Patch('users/:id')
  @PlatformAudit({ action: 'update', entityType: 'user' })
  async patchUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: PatchAdminUserDto,
  ) {
    const before = await this.adminUsers.toPublic(await this.adminUsers.findOne(id));
    const updated = await this.adminUsers.update(id, dto, user.role);
    const after = await this.adminUsers.toPublic(updated);
    await this.audit.record({
      actorUserId: user.id,
      action: 'update',
      entityType: 'user',
      entityId: id,
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
    });
    return after;
  }

  @Post('users/:id/reset-password')
  @PlatformAudit({ action: 'update', entityType: 'user' })
  async resetUserPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ResetPlatformUserPasswordDto,
  ) {
    const before = await this.adminUsers.toPublic(await this.adminUsers.findOne(id));
    await this.adminUsers.resetPassword(id, dto.password);
    const after = await this.adminUsers.toPublic(await this.adminUsers.findOne(id));
    await this.audit.record({
      actorUserId: user.id,
      action: 'update',
      entityType: 'user',
      entityId: id,
      before: before as unknown as Record<string, unknown>,
      after: { ...(after as object), passwordReset: true } as Record<string, unknown>,
    });
    return { success: true };
  }

  @Post('users/:id/mfa/disable')
  @PlatformAudit({ action: 'update', entityType: 'user' })
  async disableUserMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const before = await this.adminUsers.toPublic(await this.adminUsers.findOne(id));
    await this.adminUsers.disableMfa(id);
    const after = await this.adminUsers.toPublic(await this.adminUsers.findOne(id));
    await this.audit.record({
      actorUserId: user.id,
      action: 'update',
      entityType: 'user',
      entityId: id,
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
    });
    return { success: true, isMfaEnabled: false };
  }

  @Post('impersonate')
  @PlatformAudit({ action: 'impersonate', entityType: 'organization' })
  startImpersonation(@CurrentUser() user: AuthenticatedUser, @Body() dto: PlatformImpersonateDto) {
    return this.platform.startImpersonation(user.id, dto.organizationId);
  }

  @Get('audit/export')
  async exportAudit(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: false }) res: Response,
    @Query('format') format?: string,
    @Query('entityType') entityType?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
  ) {
    const filters = { entityType, actorUserId, organizationId, action, from, to, q };
    const fmt = format === 'json' ? 'json' : 'csv';
    const result = await this.platform.exportAudit(filters);
    await this.audit.record({
      actorUserId: user.id,
      action: 'read',
      entityType: 'platform_audit',
      query: {
        ...filters,
        format: fmt,
        exported: result.exported,
        total: result.total,
        truncated: result.truncated,
      },
    });

    if (fmt === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json(result);
      return;
    }

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="platform-audit-${date}.csv"`);
    res.send(platformAuditItemsToCsv(result.items));
  }

  @Get('audit')
  listAudit(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('entityType') entityType?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
  ) {
    return this.platform.listAudit({
      page,
      limit,
      entityType,
      actorUserId,
      organizationId,
      action,
      from,
      to,
      q,
    });
  }
}
