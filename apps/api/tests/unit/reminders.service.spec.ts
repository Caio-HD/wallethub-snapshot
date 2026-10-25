import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { RemindersService } from '@app/modules/reminders/reminders.service';
import { ReminderEntity } from '@app/database/entities/reminder.entity';
import type { OrganizationsService } from '@app/modules/organizations/organizations.service';
import type { AlertsService } from '@app/modules/alerts/alerts.service';

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const REM_ID = '00000000-0000-0000-0000-000000000003';

const setup = () => {
  const remindersRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x: object) => x),
    save: jest.fn(async (x: object) => x),
    softRemove: jest.fn(async (x: object) => x),
  } as unknown as Repository<ReminderEntity>;

  const organizationsService = {
    assertUserInOrganization: jest.fn().mockResolvedValue(undefined),
  } as unknown as OrganizationsService;

  const alertsService = {
    recordReminderDue: jest.fn().mockResolvedValue(undefined),
  } as unknown as AlertsService;

  const service = new RemindersService(remindersRepository, organizationsService, alertsService);

  return { service, remindersRepository, organizationsService, alertsService };
};

describe('RemindersService', () => {
  describe('create', () => {
    it('creates reminder with trimmed title and saves it', async () => {
      const { service, remindersRepository, organizationsService } = setup();
      const saved = { id: REM_ID, title: 'Pagar conta', recurrence: 'none' } as ReminderEntity;
      (remindersRepository.save as jest.Mock).mockResolvedValue(saved);

      const result = await service.create(ORG_ID, USER_ID, {
        title: '  Pagar conta  ',
        dueAt: '2025-06-01',
        recurrence: 'none',
      });

      expect(organizationsService.assertUserInOrganization).toHaveBeenCalledWith(USER_ID, ORG_ID);
      const created = (remindersRepository.create as jest.Mock).mock.calls[0][0];
      expect(created.title).toBe('Pagar conta');
      expect(result).toBe(saved);
    });

    it('defaults recurrence to "none" when not provided', async () => {
      const { service, remindersRepository } = setup();
      (remindersRepository.save as jest.Mock).mockResolvedValue({} as ReminderEntity);

      await service.create(ORG_ID, USER_ID, { title: 'Test', dueAt: '2025-01-01' });

      const created = (remindersRepository.create as jest.Mock).mock.calls[0][0];
      expect(created.recurrence).toBe('none');
    });
  });

  describe('listMine', () => {
    it('returns non-completed reminders ordered by dueAt', async () => {
      const { service, remindersRepository } = setup();
      const reminders = [{ id: REM_ID }] as ReminderEntity[];
      (remindersRepository.find as jest.Mock).mockResolvedValue(reminders);

      const result = await service.listMine(ORG_ID, USER_ID);

      expect(remindersRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { dueAt: 'ASC' },
        }),
      );
      expect(result).toBe(reminders);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when reminder not found', async () => {
      const { service, remindersRepository } = setup();
      (remindersRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update(ORG_ID, USER_ID, REM_ID, { title: 'Novo' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates title with trim', async () => {
      const { service, remindersRepository } = setup();
      const reminder = { id: REM_ID, title: 'Antigo', dueAt: new Date() } as ReminderEntity;
      (remindersRepository.findOne as jest.Mock).mockResolvedValue(reminder);
      (remindersRepository.save as jest.Mock).mockResolvedValue({ ...reminder, title: 'Novo' });

      const result = await service.update(ORG_ID, USER_ID, REM_ID, { title: '  Novo  ' });

      expect(result.title).toBe('Novo');
    });

    it('updates dueAt when provided', async () => {
      const { service, remindersRepository } = setup();
      const reminder = { id: REM_ID, title: 'Test', dueAt: new Date('2025-01-01') } as ReminderEntity;
      (remindersRepository.findOne as jest.Mock).mockResolvedValue(reminder);
      (remindersRepository.save as jest.Mock).mockImplementation(async (r: ReminderEntity) => r);

      await service.update(ORG_ID, USER_ID, REM_ID, { dueAt: '2025-06-15' });

      const saved = (remindersRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.dueAt.toISOString()).toContain('2025-06-15');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when reminder not found', async () => {
      const { service, remindersRepository } = setup();
      (remindersRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.remove(ORG_ID, USER_ID, REM_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('soft removes the reminder', async () => {
      const { service, remindersRepository } = setup();
      const reminder = { id: REM_ID } as ReminderEntity;
      (remindersRepository.findOne as jest.Mock).mockResolvedValue(reminder);

      await service.remove(ORG_ID, USER_ID, REM_ID);

      expect(remindersRepository.softRemove).toHaveBeenCalledWith(reminder);
    });
  });

  describe('processDueReminders', () => {
    it('fires alert and completes non-recurring reminder due today', async () => {
      const { service, remindersRepository, alertsService } = setup();
      const today = new Date();
      const reminder = {
        id: REM_ID,
        organizationId: ORG_ID,
        userId: USER_ID,
        title: 'Pagar aluguel',
        dueAt: new Date(today.toISOString().slice(0, 10) + 'T12:00:00Z'),
        recurrence: 'none',
        lastFiredAt: null,
        completedAt: null,
      } as unknown as ReminderEntity;
      (remindersRepository.find as jest.Mock).mockResolvedValue([reminder]);
      (remindersRepository.save as jest.Mock).mockResolvedValue(reminder);

      await service.processDueReminders();

      expect(alertsService.recordReminderDue).toHaveBeenCalledWith(reminder);
      const saved = (remindersRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.completedAt).toBeDefined();
    });

    it('advances dueAt by one month for monthly recurring reminders', async () => {
      const { service, remindersRepository } = setup();
      const today = new Date();
      const dueAt = new Date(today.toISOString().slice(0, 10) + 'T10:00:00Z');
      const reminder = {
        id: REM_ID,
        organizationId: ORG_ID,
        userId: USER_ID,
        title: 'Assinatura',
        dueAt,
        recurrence: 'monthly',
        lastFiredAt: null,
        completedAt: null,
      } as unknown as ReminderEntity;
      (remindersRepository.find as jest.Mock).mockResolvedValue([reminder]);
      (remindersRepository.save as jest.Mock).mockImplementation(async (r: ReminderEntity) => r);

      await service.processDueReminders();

      const saved = (remindersRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.completedAt).toBeNull();
      const expectedMonth = dueAt.getUTCMonth() === 11 ? 0 : dueAt.getUTCMonth() + 1;
      expect(saved.dueAt.getUTCMonth()).toBe(expectedMonth);
    });

    it('skips reminders not due today', async () => {
      const { service, remindersRepository, alertsService } = setup();
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const reminder = {
        id: REM_ID,
        dueAt: yesterday,
        recurrence: 'none',
        lastFiredAt: null,
        completedAt: null,
      } as unknown as ReminderEntity;
      (remindersRepository.find as jest.Mock).mockResolvedValue([reminder]);

      await service.processDueReminders();

      expect(alertsService.recordReminderDue).not.toHaveBeenCalled();
    });

    it('skips reminder already fired today', async () => {
      const { service, remindersRepository, alertsService } = setup();
      const today = new Date();
      const reminder = {
        id: REM_ID,
        dueAt: new Date(today.toISOString().slice(0, 10) + 'T10:00:00Z'),
        recurrence: 'none',
        lastFiredAt: new Date(today.toISOString().slice(0, 10) + 'T08:00:00Z'),
        completedAt: null,
      } as unknown as ReminderEntity;
      (remindersRepository.find as jest.Mock).mockResolvedValue([reminder]);

      await service.processDueReminders();

      expect(alertsService.recordReminderDue).not.toHaveBeenCalled();
    });
  });
});
