import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ElevatedAccessGuard } from '../../common/security/elevated-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { LegacyAdminUsersInterceptor } from './legacy-admin-users.interceptor';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AdminUsersService } from './admin-users.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformAudit } from './platform-audit.decorator';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { PatchAdminUserDto } from './dto/patch-admin-user.dto';
import type { UserEntity } from '../../database/entities/user.entity';

// DEPRECATED — consolidated into AdminPlatformController (`/admin/platform/users`). Kept as an
// audited shim during the deprecation window (Sunset 2026-10-01); removed in PR5 (semver major).
// The interceptor emits Deprecation/Sunset headers + a usage counter so the removal is empirical.
// Cross-org by nature, so restricted to the platform operator (super_admin + MFA via ElevatedAccessGuard).
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard, ElevatedAccessGuard)
@UseInterceptors(LegacyAdminUsersInterceptor)
@Roles('super_admin')
export class AdminUsersController {
  constructor(
    private readonly adminUsers: AdminUsersService,
    private readonly audit: PlatformAuditService,
  ) {}

  @Get()
  async list(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('q') q?: string,
  ) {
    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw ?? '20', 10) || 20));
    const { items, total } = await this.adminUsers.list({ page, limit, q });
    return {
      items: await Promise.all(items.map((u) => this.adminUsers.toPublic(u))),
      total,
      page,
      limit,
    };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const u = await this.adminUsers.findOne(id);
    return this.adminUsers.toPublic(u);
  }

  @Post()
  @PlatformAudit({ action: 'create', entityType: 'user' })
  async create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateAdminUserDto) {
    return this.audit.auditedMutation(
      {
        actorUserId: actor.id,
        action: 'create',
        entityType: 'user',
        entityId: (u) => (u as UserEntity).id,
      },
      () => Promise.resolve(null),
      () => this.adminUsers.create(dto, actor.role),
      (u) => this.adminUsers.toPublic(u as UserEntity) as Promise<Record<string, unknown>>,
    );
  }

  @Patch(':id')
  @PlatformAudit({ action: 'update', entityType: 'user' })
  async patch(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PatchAdminUserDto,
  ) {
    return this.audit.auditedMutation(
      { actorUserId: actor.id, action: 'update', entityType: 'user', entityId: id },
      async () =>
        (await this.adminUsers.toPublic(await this.adminUsers.findOne(id))) as Record<
          string,
          unknown
        >,
      () => this.adminUsers.update(id, dto, actor.role),
      (u) => this.adminUsers.toPublic(u as UserEntity) as Promise<Record<string, unknown>>,
    );
  }
}
