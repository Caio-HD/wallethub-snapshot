import { MigrationInterface, QueryRunner } from 'typeorm';

/** Contadores mensais por organização (IA WhatsApp, imports de extrato). */
export class AddOrganizationUsageCounters1770000000004 implements MigrationInterface {
  name = 'AddOrganizationUsageCounters1770000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "organization_usage_counters" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "period_yyyymm" character varying(7) NOT NULL,
        "ai_whatsapp_messages" integer NOT NULL DEFAULT 0,
        "statement_imports" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_organization_usage_counters_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_organization_usage_counters_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_organization_usage_counters_org_period" UNIQUE ("organization_id", "period_yyyymm")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_organization_usage_counters_org" ON "organization_usage_counters" ("organization_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_usage_counters"`);
  }
}
