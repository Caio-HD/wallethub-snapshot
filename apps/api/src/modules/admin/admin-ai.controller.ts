import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ElevatedAccessGuard } from '../../common/security/elevated-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAiService } from './admin-ai.service';

// Platform-management endpoint — restricted to the platform operator (see admin-users.controller).
@Controller('admin/ai')
@UseGuards(JwtAuthGuard, RolesGuard, ElevatedAccessGuard)
@Roles('super_admin')
export class AdminAiController {
  constructor(private readonly adminAi: AdminAiService) {}

  @Get('sessions')
  async sessions(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('userId') userId?: string,
    @Query('channel') channel?: 'web' | 'whatsapp',
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw ?? '20', 10) || 20));
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;
    return this.adminAi.listSessions({ page, limit, userId, channel, from, to });
  }

  @Get('traces')
  async traces(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('sessionId') sessionId?: string,
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw ?? '20', 10) || 20));
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;
    return this.adminAi.listTraces({ page, limit, sessionId, from, to });
  }

  @Get('traces/:id')
  async traceDetail(@Param('id') id: string, @Query('obsLimit') obsLimitRaw?: string) {
    const obsLimit = Math.min(500, Math.max(1, parseInt(obsLimitRaw ?? '200', 10) || 200));
    return this.adminAi.getTraceDetail(id, obsLimit);
  }
}
