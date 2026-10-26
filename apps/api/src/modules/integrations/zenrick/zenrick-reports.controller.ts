import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { format } from 'date-fns';
import { Throttle } from '@nestjs/throttler';
import { CategoriesService } from '../../categories/categories.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { ConnectorTokenGuard } from './connector-token.guard.js';
import { assertConnectorOrgAllowed } from './zenrick-org.util.js';

/**
 * Read-only reports surface for the Zenrick ecosystem (ADR adr-zenrick-connector §9):
 * WalletHub GENERATES the data, Kyron COMPOSES and DELIVERS the narrative (single-voice).
 * These endpoints let Kyron pull org-wide financial data S2S — the pieces the dashboard
 * exposes to the UI, but authenticated by the connector token instead of a user JWT.
 *
 * Scope is always org-wide ('all'): the connector reports on the whole organization,
 * not a single user. Org comes explicitly in the query and is validated against the
 * connector allowlist (same source of truth as ingestion).
 */
@Controller('integrations/zenrick/reports')
@UseGuards(ConnectorTokenGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class ZenrickReportsController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly categories: CategoriesService,
  ) {}

  @Get('summary')
  summary(
    @Query('organizationId') organizationId: string,
    @Query('period') period = format(new Date(), 'yyyy-MM'),
  ) {
    const org = assertConnectorOrgAllowed(organizationId);
    return this.dashboard.getSummary('all', period, org);
  }

  @Get('categories')
  categoriesReport(
    @Query('organizationId') organizationId: string,
    @Query('period') period = format(new Date(), 'yyyy-MM'),
  ) {
    const org = assertConnectorOrgAllowed(organizationId);
    return this.dashboard.getCategoriesReport('all', period, org);
  }

  @Get('evolution')
  evolution(@Query('organizationId') organizationId: string, @Query('months') months = '6') {
    const org = assertConnectorOrgAllowed(organizationId);
    const n = Math.min(24, Math.max(1, Number.parseInt(months, 10) || 6));
    return this.dashboard.getEvolutionReport('all', n, org);
  }

  @Get('top-transactions')
  topTransactions(
    @Query('organizationId') organizationId: string,
    @Query('period') period = format(new Date(), 'yyyy-MM'),
    @Query('limit') limit = '5',
  ) {
    const org = assertConnectorOrgAllowed(organizationId);
    const n = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 5));
    return this.dashboard.getTopTransactions('all', period, org, n);
  }

  /** Category catalog of the org — used by Kyron's assisted categorization (F4). */
  @Get('category-catalog')
  async categoryCatalog(@Query('organizationId') organizationId: string) {
    const org = assertConnectorOrgAllowed(organizationId);
    const cats = await this.categories.findAll(org);
    return cats.map((c) => ({ id: c.id, name: c.name, type: c.type }));
  }
}
