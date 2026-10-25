import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { addMonths } from 'date-fns';
import { ReminderEntity } from '../../database/entities/reminder.entity';
import { OrganizationsService } from '../organizations/organizations.service';
import { AlertsService } from '../alerts/alerts.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';

function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class RemindersService {
  constructor(
    @InjectRepository(ReminderEntity)
    private readonly remindersRepository: Repository<ReminderEntity>,
    private readonly organizationsService: OrganizationsService,
    private readonly alertsService: AlertsService,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreateReminderDto,
  ): Promise<ReminderEntity> {
    await this.organizationsService.assertUserInOrganization(userId, organizationId);
    const row = this.remindersRepository.create({
      organizationId,
      userId,
      title: dto.title.trim(),
      dueAt: new Date(dto.dueAt),
      recurrence: dto.recurrence ?? 'none',
    });
    return this.remindersRepository.save(row);
  }

  async listMine(organizationId: string, userId: string): Promise<ReminderEntity[]> {
    await this.organizationsService.assertUserInOrganization(userId, organizationId);
    return this.remindersRepository.find({
      where: { organizationId, userId, completedAt: IsNull() },
      order: { dueAt: 'ASC' },
    });
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateReminderDto,
  ): Promise<ReminderEntity> {
    const row = await this.findOwnedOrThrow(organizationId, userId, id);
    if (dto.title != null) row.title = dto.title.trim();
    if (dto.dueAt != null) row.dueAt = new Date(dto.dueAt);
    if (dto.recurrence != null) row.recurrence = dto.recurrence;
    return this.remindersRepository.save(row);
  }

  async remove(organizationId: string, userId: string, id: string): Promise<void> {
    const row = await this.findOwnedOrThrow(organizationId, userId, id);
    await this.remindersRepository.softRemove(row);
  }

  private async findOwnedOrThrow(
    organizationId: string,
    userId: string,
    id: string,
  ): Promise<ReminderEntity> {
    const row = await this.remindersRepository.findOne({
      where: { id, organizationId, userId },
    });
    if (!row) {
      throw new NotFoundException('Lembrete não encontrado');
    }
    return row;
  }

  /** Cron: dispara lembretes cuja data (UTC) é hoje; in-app via alert_events. */
  async processDueReminders(): Promise<void> {
    const today = new Date();
    const todayKey = utcYmd(today);
    const open = await this.remindersRepository.find({
      where: { completedAt: IsNull() },
    });
    for (const r of open) {
      if (utcYmd(r.dueAt) !== todayKey) {
        continue;
      }
      if (r.lastFiredAt && utcYmd(r.lastFiredAt) === todayKey) {
        continue;
      }
      await this.alertsService.recordReminderDue(r);
      const now = new Date();
      r.lastFiredAt = now;
      if (r.recurrence === 'monthly') {
        r.dueAt = addMonths(r.dueAt, 1);
      } else {
        r.completedAt = now;
      }
      await this.remindersRepository.save(r);
    }
  }
}
