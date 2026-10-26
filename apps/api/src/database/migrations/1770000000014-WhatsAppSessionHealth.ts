import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsAppSessionHealth1770000000014 implements MigrationInterface {
  name = 'WhatsAppSessionHealth1770000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "whatsapp_sessions"
      ADD COLUMN IF NOT EXISTS "disconnected_since" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "health_notified_at" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."alert_event_type_enum" ADD VALUE IF NOT EXISTS 'whatsapp_disconnected'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "whatsapp_sessions"
      DROP COLUMN IF EXISTS "disconnected_since",
      DROP COLUMN IF EXISTS "health_notified_at"
    `);
    // PostgreSQL não remove valores de ENUM de forma segura em down.
  }
}
