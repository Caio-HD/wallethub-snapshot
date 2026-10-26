import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { isUuid } from '../../common/utils/is-uuid.js';
import { DashboardService, type DashboardScope } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveOrganizationGuard } from '../../common/guards/active-organization.guard';
import { ActiveOrganization } from '../../common/decorators/active-organization.decorator';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';
import { RecalculateDashboardDto } from './dto/recalculate-dashboard.dto';
import { DateRangePipe, type DateRange } from '../../common/pipes/date-range.pipe';
import { format } from 'date-fns';

function parseDashboardScope(userId?: string): DashboardScope {
  if (userId == null || userId === '' || userId === 'all') return 'all';
  if (!isUuid(userId)) {
    throw new BadRequestException('userId deve ser um UUID válido ou omitido (Todos)');
  }
  return userId;
}

function parseAccountId(accountId?: string): string | undefined {
  if (accountId == null || accountId === '' || accountId === 'all') return undefined;
  if (!isUuid(accountId)) {
    throw new BadRequestException('accountId deve ser um UUID válido ou omitido (Todas)');
  }
  return accountId;
}

// ActiveOrganizationGuard scopes every dashboard query to the caller's active organization
// (or, for the platform operator, the impersonated org). Without it the userId='all' scope
// applied no organization filter and leaked financials across every tenant.
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveOrganizationGuard)
@Roles('admin')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Query('userId') userId: string | undefined,
    @Query('period') period: string = format(new Date(), 'yyyy-MM'),
    @Query('accountId') accountId: string | undefined,
    @Query('range', DateRangePipe) range: DateRange,
  ) {
    return this.dashboardService.getSummary(parseDashboardScope(userId), period, org.id, {
      accountId: parseAccountId(accountId),
      range,
    });
  }

  @Get('categories-report')
  getCategoriesReport(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Query('userId') userId: string | undefined,
    @Query('period') period: string = format(new Date(), 'yyyy-MM'),
    @Query('accountId') accountId: string | undefined,
    @Query('range', DateRangePipe) range: DateRange,
  ) {
    return this.dashboardService.getCategoriesReport(parseDashboardScope(userId), period, org.id, {
      accountId: parseAccountId(accountId),
      range,
    });
  }

  @Get('evolution')
  getEvolution(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Query('userId') userId: string | undefined,
    @Query('months') months: string = '6',
    @Query('accountId') accountId: string | undefined,
    @Query('range', DateRangePipe) range: DateRange,
  ) {
    const n = Math.min(24, Math.max(1, parseInt(months, 10) || 6));
    return this.dashboardService.getEvolutionReport(parseDashboardScope(userId), n, org.id, {
      accountId: parseAccountId(accountId),
      range,
    });
  }

  @Get('top-transactions')
  getTopTransactions(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Query('userId') userId: string | undefined,
    @Query('period') period: string = format(new Date(), 'yyyy-MM'),
    @Query('accountId') accountId: string | undefined,
    @Query('range', DateRangePipe) range: DateRange,
    @Query('limit') limit: string = '5',
  ) {
    const n = Math.min(50, Math.max(1, parseInt(limit, 10) || 5));
    return this.dashboardService.getTopTransactions(
      parseDashboardScope(userId),
      period,
      org.id,
      n,
      {
        accountId: parseAccountId(accountId),
        range,
      },
    );
  }

  @Get('projections')
  getProjections(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Query('userId') userId: string | undefined,
  ) {
    return this.dashboardService.getProjections(parseDashboardScope(userId), org.id);
  }

  @Get('export/csv')
  async exportCsv(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Res({ passthrough: false }) res: Response,
    @Query('userId') userId: string | undefined,
    @Query('period') period: string = format(new Date(), 'yyyy-MM'),
    @Query('includeCategorySummary') includeCategorySummary?: string,
    @Query('accountId') accountId?: string,
    @Query('range', DateRangePipe) range?: DateRange,
  ) {
    const csv = await this.dashboardService.getExportCsv(
      parseDashboardScope(userId),
      period,
      includeCategorySummary === 'true' || includeCategorySummary === '1',
      org.id,
      { accountId: parseAccountId(accountId), range },
    );
    const filename = `wallethub-${period}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Post('recalculate')
  async recalculate(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Body() dto: RecalculateDashboardDto,
  ) {
    await this.dashboardService.requestRecalculation(
      parseDashboardScope(dto.userId),
      'manual',
      org.id,
    );
    return { success: true };
  }
}
