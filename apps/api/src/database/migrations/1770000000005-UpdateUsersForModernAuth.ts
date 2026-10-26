import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUsersForModernAuth1770000000005 implements MigrationInterface {
  name = 'UpdateUsersForModernAuth1770000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add missing auth fields
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "email_verified" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "phone_verified" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "google_id" character varying,
      ADD COLUMN IF NOT EXISTS "github_id" character varying,
      ADD COLUMN IF NOT EXISTS "mfa_secret" character varying,
      ADD COLUMN IF NOT EXISTS "is_mfa_enabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "passkeys" jsonb
    `);

    // 2. Make phone_number and password_hash nullable (required for social/email-only/phone-only auth)
    await queryRunner.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "phone_number" DROP NOT NULL,
      ALTER COLUMN "password_hash" DROP NOT NULL
    `);

    // 3. Add unique constraints for social IDs
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_google_id" ON "users" ("google_id") WHERE google_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_github_id" ON "users" ("github_id") WHERE github_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_github_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_google_id"`);

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "phone_number" SET NOT NULL,
      ALTER COLUMN "password_hash" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "passkeys",
      DROP COLUMN IF EXISTS "is_mfa_enabled",
      DROP COLUMN IF EXISTS "mfa_secret",
      DROP COLUMN IF EXISTS "github_id",
      DROP COLUMN IF EXISTS "google_id",
      DROP COLUMN IF EXISTS "phone_verified",
      DROP COLUMN IF EXISTS "email_verified"
    `);
  }
}
