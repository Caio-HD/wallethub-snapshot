import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Login social via Meta (Facebook Login) — adiciona `users.facebook_id` para
 * vincular contas autenticadas pelo provedor Meta, espelhando `google_id` /
 * `github_id`.
 *
 * Aditiva e idempotente (ADD COLUMN IF NOT EXISTS + índice único parcial).
 * down() remove apenas a coluna/índice — sem perda de dados de outras contas.
 */
export class UserFacebookId1770000000025 implements MigrationInterface {
  name = 'UserFacebookId1770000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "facebook_id" varchar
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_facebook_id"
      ON "users" ("facebook_id")
      WHERE "facebook_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_facebook_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "facebook_id"`);
  }
}
