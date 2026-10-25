import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Telegram Bot (DM): eventos, ligação de utilizador, extensão de enums,
 * quota IA unificada (coluna renomeada), rastreio de agente.
 */
export class TelegramIntegration1770000000007 implements MigrationInterface {
  name = 'TelegramIntegration1770000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "telegram_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "provider_message_id" character varying NOT NULL,
        "from_telegram_user_id" character varying NOT NULL,
        "direction" "public"."whatsapp_event_direction_enum" NOT NULL,
        "payload" jsonb NOT NULL,
        "parsed_command" character varying,
        "status" "public"."whatsapp_event_status_enum" NOT NULL DEFAULT 'received',
        "processed_at" TIMESTAMP,
        CONSTRAINT "PK_telegram_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_telegram_events_provider_message_id" UNIQUE ("provider_message_id"),
        CONSTRAINT "FK_telegram_events_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_telegram_events_organization_created" ON "telegram_events" ("organization_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_telegram_events_from_user_created" ON "telegram_events" ("from_telegram_user_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "telegram_link_nonces" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "nonce" character varying(32) NOT NULL,
        "user_id" uuid NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_telegram_link_nonces_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_telegram_link_nonces_nonce" UNIQUE ("nonce"),
        CONSTRAINT "FK_telegram_link_nonces_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_telegram_link_nonces_expires_at" ON "telegram_link_nonces" ("expires_at")`,
    );

    await queryRunner.query(
      `ALTER TYPE "public"."transaction_source_enum" ADD VALUE IF NOT EXISTS 'telegram'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."ai_channel_enum" ADD VALUE IF NOT EXISTS 'telegram'`,
    );

    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "telegram_user_id" character varying`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_telegram_user_id" ON "users" ("telegram_user_id") WHERE "telegram_user_id" IS NOT NULL AND "deleted_at" IS NULL`,
    );

    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN "telegram_event_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_telegram_event_id"
      FOREIGN KEY ("telegram_event_id") REFERENCES "telegram_events"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_telegram_event_id" ON "transactions" ("telegram_event_id") WHERE "telegram_event_id" IS NOT NULL`,
    );

    await queryRunner.query(`ALTER TABLE "ai_agent_traces" ADD COLUMN "telegram_event_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "ai_agent_traces" ADD CONSTRAINT "FK_ai_agent_traces_telegram_event"
      FOREIGN KEY ("telegram_event_id") REFERENCES "telegram_events"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_agent_traces_telegram_event_id" ON "ai_agent_traces" ("telegram_event_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "organization_usage_counters"
      RENAME COLUMN "ai_whatsapp_messages" TO "ai_messaging_assistant_messages"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organization_usage_counters"
      RENAME COLUMN "ai_messaging_assistant_messages" TO "ai_whatsapp_messages"
    `);
    await queryRunner.query(
      `ALTER TABLE "ai_agent_traces" DROP CONSTRAINT IF EXISTS "FK_ai_agent_traces_telegram_event"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_ai_agent_traces_telegram_event_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_agent_traces" DROP COLUMN IF EXISTS "telegram_event_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_telegram_event_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_transactions_telegram_event_id"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN IF EXISTS "telegram_event_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_users_telegram_user_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "telegram_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "telegram_link_nonces"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "telegram_events"`);
    /* Valores de enum 'telegram' permanecem — remoção exigiria recriar tipos. */
  }
}
