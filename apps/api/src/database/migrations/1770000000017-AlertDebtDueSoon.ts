import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADD VALUE não é reversível em PostgreSQL — rollback documentado como irreversível
 * (valor enum órfão aceitável, padrão Telegram/WhatsApp migrations).
 */
export class AlertDebtDueSoon1770000000017 implements MigrationInterface {
  name = 'AlertDebtDueSoon1770000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."alert_event_type_enum" ADD VALUE IF NOT EXISTS 'debt_due_soon'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    /* Valor 'debt_due_soon' permanece — remoção exigiria recriar alert_event_type_enum. */
  }
}
