import { MigrationInterface, QueryRunner } from 'typeorm';

export class QaAdminTenants1770000000010 implements MigrationInterface {
  name = 'QaAdminTenants1770000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "is_qa" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_organizations_is_qa_created_at"
      ON "organizations" ("is_qa", "created_at")
      WHERE "is_qa" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_is_qa_created_at"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "is_qa"`);
  }
}
