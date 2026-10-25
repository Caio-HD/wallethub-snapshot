import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Instâncias Evolution por organização, eventos com organization_id explícito,
 * entregas de digest diário.
 */
export class WhatsAppEvolutionPerOrg1770000000013 implements MigrationInterface {
  name = 'WhatsAppEvolutionPerOrg1770000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "whatsapp_sessions"
      ADD COLUMN IF NOT EXISTS "evolution_instance_name" character varying,
      ADD COLUMN IF NOT EXISTS "webhook_secret" character varying,
      ADD COLUMN IF NOT EXISTS "connected_phone" character varying,
      ADD COLUMN IF NOT EXISTS "last_sync_at" TIMESTAMP
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_whatsapp_sessions_organization_id"
      ON "whatsapp_sessions" ("organization_id")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_whatsapp_sessions_evolution_instance_name"
      ON "whatsapp_sessions" ("evolution_instance_name")
      WHERE "evolution_instance_name" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "whatsapp_events"
      ADD COLUMN IF NOT EXISTS "organization_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "whatsapp_events"
      DROP CONSTRAINT IF EXISTS "FK_whatsapp_events_organization"
    `);
    await queryRunner.query(`
      ALTER TABLE "whatsapp_events"
      ADD CONSTRAINT "FK_whatsapp_events_organization"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_events_organization_created"
      ON "whatsapp_events" ("organization_id", "created_at")
      WHERE "organization_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_digest_deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "digest_date" date NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'sent',
        "error_message" character varying,
        CONSTRAINT "PK_whatsapp_digest_deliveries_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_whatsapp_digest_deliveries_org_date" UNIQUE ("organization_id", "digest_date"),
        CONSTRAINT "FK_whatsapp_digest_deliveries_organization"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_digest_deliveries"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_whatsapp_events_organization_created"`);
    await queryRunner.query(`
      ALTER TABLE "whatsapp_events" DROP CONSTRAINT IF EXISTS "FK_whatsapp_events_organization"
    `);
    await queryRunner.query(
      `ALTER TABLE "whatsapp_events" DROP COLUMN IF EXISTS "organization_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_whatsapp_sessions_evolution_instance_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_whatsapp_sessions_organization_id"`);
    await queryRunner.query(`
      ALTER TABLE "whatsapp_sessions"
      DROP COLUMN IF EXISTS "last_sync_at",
      DROP COLUMN IF EXISTS "connected_phone",
      DROP COLUMN IF EXISTS "webhook_secret",
      DROP COLUMN IF EXISTS "evolution_instance_name"
    `);
  }
}
