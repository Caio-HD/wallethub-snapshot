import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Definir/trocar senha (Identity F3c). Distingue uma senha real de um hash
 * placeholder (contas criadas via social/OTP recebem um hash aleatório que o
 * usuário não conhece). `has_password=true` ⇒ exigir a senha atual para trocar.
 *
 * Backfill conservador: `false` para todos. O cadastro do WalletHub é via OTP
 * (hash placeholder), então a maioria não tem senha utilizável; quem realmente
 * tem definirá novamente (operação autenticada, sem risco). A flag passa a
 * `true` ao definir/redefinir senha daqui em diante. Aditiva e idempotente.
 */
export class UserHasPassword1770000000027 implements MigrationInterface {
  name = 'UserHasPassword1770000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "has_password" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "has_password"`);
  }
}
