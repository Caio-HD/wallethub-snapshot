import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Normalizes stored emails to lowercase.
 * - Resolves legacy caiohsdias / caiohsdias1 duplicate (typo gmai.com vs gmail.com).
 * - Replaces case-sensitive UNIQUE(email) with case-insensitive unique on lower(email).
 */
export class UserEmailCaseInsensitiveUnique1770000000019 implements MigrationInterface {
  name = 'UserEmailCaseInsensitiveUnique1770000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Legacy duplicate: keep active owner account, drop email from inactive shadow row.
    await queryRunner.query(`
      UPDATE "users"
      SET "email" = NULL
      WHERE "id" = '84f9a5b2-0455-4df5-8606-feb48ce4ae02'
        AND "username" = 'caiohsdias1'
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET
        "email" = 'owner@example.com',
        "email_verified" = true
      WHERE "id" = 'be93a2ef-416b-4150-9ba6-7ed44659c27d'
        AND "username" = 'caiohsdias'
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "email" = lower(trim("email"))
      WHERE "email" IS NOT NULL
    `);

    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_users_email"`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email_lower"
      ON "users" (lower("email"))
      WHERE "email" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_email_lower"`);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "UQ_users_email" UNIQUE ("email")
    `);
  }
}
