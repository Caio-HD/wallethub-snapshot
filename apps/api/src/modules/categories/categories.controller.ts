import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ActiveOrganizationGuard } from '../../common/guards/active-organization.guard';
import { ActiveOrganization } from '../../common/decorators/active-organization.decorator';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveOrganizationGuard)
@Roles('admin')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(@ActiveOrganization() org: ActiveOrganizationContext) {
    return this.categoriesService.findAll(org.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(dto, user.id, org.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto, org.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @ActiveOrganization() org: ActiveOrganizationContext) {
    await this.categoriesService.remove(id, org.id);
    return { success: true };
  }

  @Post('reorder')
  async reorder(
    @Body() dto: ReorderCategoriesDto,
    @ActiveOrganization() org: ActiveOrganizationContext,
  ) {
    await this.categoriesService.reorder(dto, org.id);
    return { success: true };
  }
}
