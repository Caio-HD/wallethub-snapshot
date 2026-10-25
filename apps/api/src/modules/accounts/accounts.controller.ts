import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserEntity } from '../../database/entities/user.entity.js';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ActiveOrganizationGuard } from '../../common/guards/active-organization.guard';
import { ActiveOrganization } from '../../common/decorators/active-organization.decorator';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';

@Controller('accounts')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveOrganizationGuard)
@Roles('admin')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  findAll(@CurrentUser() user: UserEntity, @ActiveOrganization() org: ActiveOrganizationContext) {
    return this.accountsService.findAll(user.id, org.id);
  }

  @Post()
  create(
    @Body() dto: CreateAccountDto,
    @CurrentUser() user: UserEntity,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    return this.accountsService.create(dto, user.id, org.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: UserEntity,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    return this.accountsService.update(id, dto, user.id, org.id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ): Promise<void> {
    await this.accountsService.remove(id, org.id, user.id, org.impersonated === true);
  }
}
