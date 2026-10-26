import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Troca de username self-service (Identity F3a) — registra quando o usuário
 * trocou o username pela última vez, para aplicar o cooldown (1x / 30 dias).
 * Aditiva e idempotente; nullable (NULL = nunca trocou).
 */
export class UserUsernameChangedAt1770000000026 implements MigrationInterface {
  name = 'UserUsernameChangedAt1770000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "username_changed_at" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "username_changed_at"`);
  }
}
