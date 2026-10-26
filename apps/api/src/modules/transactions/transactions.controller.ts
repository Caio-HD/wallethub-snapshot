import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { BulkCategorizeDto } from './dto/bulk-categorize.dto';
import { DateRangePipe } from '../../common/pipes/date-range.pipe';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ActiveOrganizationGuard } from '../../common/guards/active-organization.guard';
import { ActiveOrganization } from '../../common/decorators/active-organization.decorator';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveOrganizationGuard)
@Roles('admin')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  findAll(
    @Query() filter: FilterTransactionsDto,
    @Query('range', DateRangePipe) range: { start?: Date; end?: Date },
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    return this.transactionsService.findAll({ ...filter, range, organizationId: org.id });
  }

  /** Transações ainda em "Sem categoria", agrupadas por descrição (para categorizar em lote). */
  @Get('uncategorized')
  uncategorized(
    @Query('accountId') accountId: string | undefined,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    return this.transactionsService.findUncategorizedGroups(org.id, accountId || undefined);
  }

  @Post()
  create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    return this.transactionsService.create({ ...dto, userId: dto.userId ?? user.id }, org.id);
  }

  /** Cria uma transferência (movimento neutro): pareada entre contas ou leg único externo. */
  @Post('transfer')
  createTransfer(
    @Body() dto: CreateTransferDto,
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    return this.transactionsService.createTransfer(
      { ...dto, userId: dto.userId ?? user.id },
      org.id,
    );
  }

  /** Categoriza várias transações de uma vez (e aprende o mapeamento descrição→categoria). */
  @Post('bulk-categorize')
  bulkCategorize(
    @Body() dto: BulkCategorizeDto,
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    return this.transactionsService.bulkCategorize(
      org.id,
      dto.transactionIds,
      dto.categoryId,
      user.id,
      org.impersonated === true,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    return this.transactionsService.update(id, dto, user.id, org.impersonated === true);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    await this.transactionsService.remove(id, user.id, org.impersonated === true);
    return { success: true };
  }
}
