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
import { ActiveOrganizationGuard } from '../../common/guards/active-organization.guard';
import { ActiveOrganization } from '../../common/decorators/active-organization.decorator';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RemindersService } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';

@Controller('reminders')
@UseGuards(JwtAuthGuard, ActiveOrganizationGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  create(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReminderDto,
  ) {
    return this.remindersService.create(org.id, user.id, dto);
  }

  @Get()
  list(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.remindersService.listMine(org.id, user.id);
  }

  @Patch(':id')
  update(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateReminderDto,
  ) {
    return this.remindersService.update(org.id, user.id, id, dto);
  }

  @Delete(':id')
  remove(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.remindersService.remove(org.id, user.id, id);
  }
}
