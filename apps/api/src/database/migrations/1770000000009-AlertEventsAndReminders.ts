import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertEventsAndReminders1770000000009 implements MigrationInterface {
  name = 'AlertEventsAndReminders1770000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."alert_event_type_enum" AS ENUM('negative_balance', 'reminder_due')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."reminder_recurrence_enum" AS ENUM('none', 'monthly')
    `);

    await queryRunner.query(`
      CREATE TABLE "alert_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "user_id" uuid,
        "type" "public"."alert_event_type_enum" NOT NULL,
        "title" character varying(512) NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "read_at" TIMESTAMP,
        CONSTRAINT "PK_alert_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_alert_events_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_alert_events_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_alert_events_org_created" ON "alert_events" ("organization_id", "created_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "reminders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "title" character varying(256) NOT NULL,
        "due_at" TIMESTAMP NOT NULL,
        "recurrence" "public"."reminder_recurrence_enum" NOT NULL DEFAULT 'none',
        "completed_at" TIMESTAMP,
        "last_fired_at" TIMESTAMP,
        CONSTRAINT "PK_reminders_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reminders_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reminders_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_reminders_org_due" ON "reminders" ("organization_id", "due_at") WHERE "deleted_at" IS NULL AND "completed_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_reminders_org_due"`);
    await queryRunner.query(`DROP TABLE "reminders"`);
    await queryRunner.query(`DROP TYPE "public"."reminder_recurrence_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_alert_events_org_created"`);
    await queryRunner.query(`DROP TABLE "alert_events"`);
    await queryRunner.query(`DROP TYPE "public"."alert_event_type_enum"`);
  }
}
