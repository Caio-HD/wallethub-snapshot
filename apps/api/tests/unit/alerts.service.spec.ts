import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { AlertsService } from '@app/modules/alerts/alerts.service';
import { AlertEventEntity } from '@app/database/entities/alert-event.entity';
import { ReminderEntity } from '@app/database/entities/reminder.entity';

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const ALERT_ID = '00000000-0000-0000-0000-000000000003';

const setup = () => {
  const alertRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x: object) => x),
    save: jest.fn(async (x: object) => x),
  } as unknown as Repository<AlertEventEntity>;

  const service = new AlertsService(alertRepository);
  return { service, alertRepository };
};

describe('AlertsService', () => {
  describe('recordNegativeBalance', () => {
    it('saves alert with correct title for org-wide scope', async () => {
      const { service, alertRepository } = setup();

      await service.recordNegativeBalance({
        organizationId: ORG_ID,
        scope: 'all',
        projectedBalance: -500,
        month: '2025-01',
        generatedAt: new Date().toISOString(),
      });

      const savedAlert = (alertRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedAlert.type).toBe('negative_balance');
      expect(savedAlert.title).toContain('organização');
      expect(savedAlert.userId).toBeNull();
    });

    it('saves alert with user-scoped title and userId when scope is a userId', async () => {
      const { service, alertRepository } = setup();

      await service.recordNegativeBalance({
        organizationId: ORG_ID,
        scope: USER_ID,
        projectedBalance: -100,
        month: '2025-02',
        generatedAt: new Date().toISOString(),
      });

      const savedAlert = (alertRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedAlert.title).not.toContain('organização');
      expect(savedAlert.userId).toBe(USER_ID);
    });

    it('formats projected balance with 2 decimal places in title', async () => {
      const { service, alertRepository } = setup();

      await service.recordNegativeBalance({
        organizationId: ORG_ID,
        scope: 'all',
        projectedBalance: -1234.5,
        month: '2025-03',
        generatedAt: new Date().toISOString(),
      });

      const savedAlert = (alertRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedAlert.title).toContain('-1234.50');
    });
  });

  describe('recordReminderDue', () => {
    it('saves reminder_due alert with correct data', async () => {
      const { service, alertRepository } = setup();
      const reminder = {
        id: 'rem-1',
        organizationId: ORG_ID,
        userId: USER_ID,
        title: 'Pagar fatura',
        dueAt: new Date('2025-01-15'),
      } as ReminderEntity;

      await service.recordReminderDue(reminder);

      const savedAlert = (alertRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedAlert.type).toBe('reminder_due');
      expect(savedAlert.title).toBe('Pagar fatura');
      expect(savedAlert.payload).toEqual(
        expect.objectContaining({ reminderId: 'rem-1' }),
      );
    });
  });

  describe('listForActiveUser', () => {
    it('returns alerts ordered by createdAt DESC limited to 50', async () => {
      const { service, alertRepository } = setup();
      const alerts = [{ id: ALERT_ID }] as AlertEventEntity[];
      (alertRepository.find as jest.Mock).mockResolvedValue(alerts);

      const result = await service.listForActiveUser(ORG_ID, USER_ID);

      expect(alertRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC' },
          take: 50,
        }),
      );
      expect(result).toBe(alerts);
    });

    it('uses custom limit when provided', async () => {
      const { service, alertRepository } = setup();
      (alertRepository.find as jest.Mock).mockResolvedValue([]);

      await service.listForActiveUser(ORG_ID, USER_ID, 10);

      expect(alertRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  describe('markRead', () => {
    it('throws NotFoundException when alert not found', async () => {
      const { service, alertRepository } = setup();
      (alertRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.markRead(ORG_ID, USER_ID, ALERT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFoundException when alert belongs to different user', async () => {
      const { service, alertRepository } = setup();
      const alert = { id: ALERT_ID, organizationId: ORG_ID, userId: 'other-user' } as AlertEventEntity;
      (alertRepository.findOne as jest.Mock).mockResolvedValue(alert);

      await expect(service.markRead(ORG_ID, USER_ID, ALERT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('sets readAt and saves when alert belongs to user', async () => {
      const { service, alertRepository } = setup();
      const alert = { id: ALERT_ID, organizationId: ORG_ID, userId: USER_ID, readAt: null } as AlertEventEntity;
      (alertRepository.findOne as jest.Mock).mockResolvedValue(alert);
      (alertRepository.save as jest.Mock).mockResolvedValue({ ...alert, readAt: new Date() });

      const result = await service.markRead(ORG_ID, USER_ID, ALERT_ID);

      expect(result.readAt).toBeDefined();
    });

    it('marks org-wide alert (userId null) as read by any user', async () => {
      const { service, alertRepository } = setup();
      const alert = { id: ALERT_ID, organizationId: ORG_ID, userId: null, readAt: null } as AlertEventEntity;
      (alertRepository.findOne as jest.Mock).mockResolvedValue(alert);
      (alertRepository.save as jest.Mock).mockResolvedValue({ ...alert, readAt: new Date() });

      const result = await service.markRead(ORG_ID, USER_ID, ALERT_ID);

      expect(result.readAt).toBeDefined();
    });
  });
});
