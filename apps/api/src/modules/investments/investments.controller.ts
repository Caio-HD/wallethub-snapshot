import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveOrganizationGuard } from '../../common/guards/active-organization.guard';
import { ActiveOrganization } from '../../common/decorators/active-organization.decorator';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { InvestmentsService } from './investments.service';
import { CreateInvestmentMovementDto } from './dto/create-investment-movement.dto';

@Controller('investments')
@UseGuards(JwtAuthGuard)
export class InvestmentsController {
  constructor(private readonly investments: InvestmentsService) {}

  @Get('search-assets')
  searchAssets(@Query('q') q: string, @Query('market') market: 'BR' | 'INTL' = 'BR') {
    return this.investments.searchAssets(q || '', market);
  }

  @Get('historical-price')
  getHistoricalPrice(
    @Query('symbol') symbol: string,
    @Query('market') market: 'BR' | 'INTL',
    @Query('date') date: string,
  ) {
    return this.investments.getHistoricalPrice(symbol, market, date);
  }

  @Get('portfolio')
  getPortfolio(@CurrentUser() user: AuthenticatedUser, @Query('userId') userId?: string) {
    return this.investments.getPortfolioSummary(user.id, userId);
  }

  @Get('period-summary')
  getPeriodSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('period') period: string,
    @Query('userId') userId?: string,
  ) {
    return this.investments.getPeriodSummary(user.id, period, userId);
  }

  @Get('movements')
  listMovements(@CurrentUser() user: AuthenticatedUser, @Query('userId') userId?: string) {
    return this.investments.listMovements(user.id, userId);
  }

  @Post('movements')
  @UseGuards(ActiveOrganizationGuard)
  createMovement(
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Body() dto: CreateInvestmentMovementDto,
  ) {
    return this.investments.createMovement(user.id, dto, org.id);
  }

  @Delete('movements/:id')
  async deleteMovement(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.investments.deleteMovement(user.id, id);
    return { success: true };
  }
}
