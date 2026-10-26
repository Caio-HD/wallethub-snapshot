import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessagingAiSeatOnMembership1770000000008 implements MigrationInterface {
  name = 'MessagingAiSeatOnMembership1770000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organization_memberships"
      ADD COLUMN "messaging_ai_enabled" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_organization_memberships_messaging_ai"
      ON "organization_memberships" ("organization_id", "messaging_ai_enabled")
      WHERE "messaging_ai_enabled" = true AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_organization_memberships_messaging_ai"`);
    await queryRunner.query(
      `ALTER TABLE "organization_memberships" DROP COLUMN "messaging_ai_enabled"`,
    );
  }
}
