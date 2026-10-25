import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AlertEventEntity } from '../../database/entities/alert-event.entity';
import { ReminderEntity } from '../../database/entities/reminder.entity';

export type NegativeBalanceJobPayload = {
  organizationId: string;
  scope: string;
  projectedBalance: number;
  month: string;
  generatedAt: string;
};

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(AlertEventEntity)
    private readonly alertRepository: Repository<AlertEventEntity>,
  ) {}

  async recordNegativeBalance(payload: NegativeBalanceJobPayload): Promise<void> {
    const { organizationId, scope, projectedBalance, month } = payload;
    const userId = scope === 'all' ? null : scope;
    const title =
      scope === 'all'
        ? `Saldo projectado negativo em ${month} (organização): R$ ${projectedBalance.toFixed(2)}`
        : `Saldo projectado negativo em ${month}: R$ ${projectedBalance.toFixed(2)}`;
    await this.alertRepository.save(
      this.alertRepository.create({
        organizationId,
        userId,
        type: 'negative_balance',
        title,
        payload: payload as unknown as Record<string, unknown>,
      }),
    );
  }

  async recordWhatsAppDisconnected(organizationId: string, message: string): Promise<void> {
    await this.alertRepository.save(
      this.alertRepository.create({
        organizationId,
        userId: null,
        type: 'whatsapp_disconnected',
        title: message,
        payload: { detectedAt: new Date().toISOString() },
      }),
    );
  }

  async recordReminderDue(reminder: ReminderEntity): Promise<void> {
    await this.alertRepository.save(
      this.alertRepository.create({
        organizationId: reminder.organizationId,
        userId: reminder.userId,
        type: 'reminder_due',
        title: reminder.title,
        payload: { reminderId: reminder.id, dueAt: reminder.dueAt.toISOString() },
      }),
    );
  }

  async recordDebtDueSoon(input: {
    organizationId: string;
    debtId: string;
    debtName: string;
    installmentId: string;
    dueDate: string;
    amount: string;
  }): Promise<void> {
    const existing = await this.alertRepository
      .createQueryBuilder('a')
      .where('a.organization_id = :organizationId', { organizationId: input.organizationId })
      .andWhere('a.type = :type', { type: 'debt_due_soon' })
      .andWhere('a.read_at IS NULL')
      .andWhere("a.payload->>'installmentId' = :installmentId", {
        installmentId: input.installmentId,
      })
      .getOne();
    if (existing) {
      return;
    }

    await this.alertRepository.save(
      this.alertRepository.create({
        organizationId: input.organizationId,
        userId: null,
        type: 'debt_due_soon',
        title: `Parcela de ${input.debtName} vence em ${input.dueDate}: R$ ${input.amount}`,
        payload: {
          debtId: input.debtId,
          installmentId: input.installmentId,
          dueDate: input.dueDate,
          amount: input.amount,
        },
      }),
    );
  }

  async markDebtAlertsRead(debtId: string): Promise<void> {
    await this.alertRepository
      .createQueryBuilder()
      .update(AlertEventEntity)
      .set({ readAt: new Date() })
      .where("type = 'debt_due_soon'")
      .andWhere('read_at IS NULL')
      .andWhere("payload->>'debtId' = :debtId", { debtId })
      .execute();
  }

  async listForActiveUser(
    organizationId: string,
    userId: string,
    limit = 50,
  ): Promise<AlertEventEntity[]> {
    return this.alertRepository.find({
      where: [
        { organizationId, userId: IsNull() },
        { organizationId, userId },
      ],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async markRead(
    organizationId: string,
    userId: string,
    alertId: string,
  ): Promise<AlertEventEntity> {
    const alert = await this.alertRepository.findOne({ where: { id: alertId, organizationId } });
    if (!alert) {
      throw new NotFoundException('Alerta não encontrado');
    }
    if (alert.userId != null && alert.userId !== userId) {
      throw new NotFoundException('Alerta não encontrado');
    }
    alert.readAt = new Date();
    return this.alertRepository.save(alert);
  }
}
