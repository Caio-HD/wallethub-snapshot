import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveOrganizationGuard } from '../../common/guards/active-organization.guard';
import { ActiveOrganization } from '../../common/decorators/active-organization.decorator';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { DebtsService } from './debts.service.js';
import { CreateDebtDto } from './dto/create-debt.dto.js';
import { UpdateDebtDto } from './dto/update-debt.dto.js';
import { PayDebtInstallmentDto, UpdateDebtInstallmentDto } from './dto/pay-debt-installment.dto.js';

@Controller('debts')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveOrganizationGuard)
@Roles('admin')
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Get()
  list(@ActiveOrganization() org: ActiveOrganizationContext) {
    return this.debtsService.list(org.id);
  }

  @Get('summary')
  summary(@ActiveOrganization() org: ActiveOrganizationContext) {
    return this.debtsService.getSummary(org.id);
  }

  @Post()
  create(@ActiveOrganization() org: ActiveOrganizationContext, @Body() dto: CreateDebtDto) {
    return this.debtsService.create(org.id, dto);
  }

  @Get(':id/installments')
  async listInstallmentsRoute(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    await this.debtsService.findOne(org.id, id);
    return this.debtsService.listInstallments(id);
  }

  @Get(':id')
  findOne(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.debtsService.findOne(org.id, id);
  }

  @Patch(':id')
  update(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateDebtDto,
  ) {
    return this.debtsService.update(org.id, id, dto);
  }

  @Delete(':id')
  async remove(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    await this.debtsService.remove(org.id, id);
    return { success: true };
  }

  @Patch(':id/installments/:installmentId')
  patchInstallment(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('installmentId', new ParseUUIDPipe({ version: '4' })) installmentId: string,
    @Body() dto: UpdateDebtInstallmentDto,
  ) {
    return this.debtsService.patchInstallment(org.id, id, installmentId, dto);
  }

  @Post(':id/installments/:installmentId/pay')
  payInstallment(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('installmentId', new ParseUUIDPipe({ version: '4' })) installmentId: string,
    @Body() dto: PayDebtInstallmentDto,
  ) {
    return this.debtsService.payInstallment(org.id, id, installmentId, user.id, dto);
  }

  @Post(':id/installments/:installmentId/unpay')
  unpayInstallment(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('installmentId', new ParseUUIDPipe({ version: '4' })) installmentId: string,
  ) {
    return this.debtsService.unpayInstallment(org.id, id, installmentId, user.id);
  }

  @Post(':id/installments/:installmentId/skip')
  skipInstallment(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('installmentId', new ParseUUIDPipe({ version: '4' })) installmentId: string,
  ) {
    return this.debtsService.skipInstallment(org.id, id, installmentId);
  }

  @Post(':id/pay-remaining')
  payRemaining(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: PayDebtInstallmentDto,
  ) {
    return this.debtsService.payRemaining(org.id, id, user.id, dto);
  }
}
