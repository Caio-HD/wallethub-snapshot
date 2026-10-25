import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformAuditLog1770000000018 implements MigrationInterface {
  name = 'PlatformAuditLog1770000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Platform operator (super_admin) audit trail. Additive, non-destructive.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_audit_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actor_user_id" uuid,
        "action" varchar(32) NOT NULL,
        "entity_type" varchar(64) NOT NULL,
        "entity_id" uuid,
        "organization_id" uuid,
        "before" jsonb,
        "after" jsonb,
        "query" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "FK_platform_audit_actor"
          FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_platform_audit_entity"
        ON "platform_audit_log" ("entity_type", "entity_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_platform_audit_actor_created"
        ON "platform_audit_log" ("actor_user_id", "created_at" DESC)
    `);

    // Distinguish financial writes performed by a super_admin while impersonating an org.
    await queryRunner.query(`
      ALTER TABLE "transaction_audit"
        ADD COLUMN IF NOT EXISTS "under_impersonation" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_audit" DROP COLUMN IF EXISTS "under_impersonation"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_platform_audit_actor_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_platform_audit_entity"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_audit_log"`);
  }
}
