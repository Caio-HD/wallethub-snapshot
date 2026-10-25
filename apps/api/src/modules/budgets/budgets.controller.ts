import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { isUuid } from '../../common/utils/is-uuid.js';
import { BudgetsService, type BudgetScope } from './budgets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveOrganizationGuard } from '../../common/guards/active-organization.guard';
import { ActiveOrganization } from '../../common/decorators/active-organization.decorator';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';
import { CreateCategoryBudgetDto } from './dto/create-category-budget.dto';
import { UpdateMonthlyBudgetDto } from './dto/update-monthly-budget.dto';
import { format } from 'date-fns';

function parseBudgetScope(userId?: string): BudgetScope {
  if (userId == null || userId === '' || userId === 'all') return 'all';
  if (!isUuid(userId)) {
    throw new BadRequestException('userId deve ser um UUID válido ou omitido (Todos)');
  }
  return userId;
}

@Controller('budgets')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveOrganizationGuard)
@Roles('admin')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get('category')
  getCategoryBudgets(
    @Query('userId') userId: string | undefined,
    @Query('period') period: string = format(new Date(), 'yyyy-MM'),
  ) {
    return this.budgetsService.getCategoryBudgets(parseBudgetScope(userId), period);
  }

  @Put('category')
  async setCategoryBudget(
    @Body() dto: CreateCategoryBudgetDto,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    return this.budgetsService.setCategoryBudget(
      dto.categoryId,
      parseBudgetScope(dto.userId),
      dto.period,
      dto.amount,
      org.id,
    );
  }

  @Delete('category')
  async deleteCategoryBudget(
    @Query('categoryId') categoryId: string,
    @Query('userId') userId: string | undefined,
    @Query('period') period: string = format(new Date(), 'yyyy-MM'),
  ) {
    await this.budgetsService.deleteCategoryBudget(categoryId, parseBudgetScope(userId), period);
    return { success: true };
  }

  @Get('monthly')
  getMonthlyBudget(
    @Query('userId') userId: string | undefined,
    @Query('period') period: string = format(new Date(), 'yyyy-MM'),
  ) {
    return this.budgetsService.getMonthlyBudget(parseBudgetScope(userId), period);
  }

  @Put('monthly')
  setMonthlyBudget(
    @Body() dto: UpdateMonthlyBudgetDto,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    return this.budgetsService.setMonthlyBudget(
      parseBudgetScope(dto.userId),
      dto.period,
      dto.amount,
      org.id,
      dto.estimatedAverageIncome,
    );
  }
}
