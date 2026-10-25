import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vínculo investimento ↔ caixa: a conta de origem/destino do dinheiro de um aporte/resgate, e o
 * grupo de transferência (neutra) criado no caixa para refletir o movimento no saldo da conta.
 * Ver ADR adr-transfer-type-and-fixed-income.
 *
 * - account_id (uuid, nullable): conta de caixa do movimento (NULL = carteira sem caixa vinculado).
 * - cash_transfer_group_id (uuid, nullable): transfer_group_id da transferência de caixa gerada,
 *   para reverter (remover os legs) ao apagar o movimento.
 */
export class InvestmentMovementCashLink1770000000033 implements MigrationInterface {
  name = 'InvestmentMovementCashLink1770000000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    await queryRunner.query(`
      ALTER TABLE "investment_movements"
        ADD COLUMN IF NOT EXISTS "account_id" uuid,
        ADD COLUMN IF NOT EXISTS "cash_transfer_group_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IX_investment_movements_account"
        ON "investment_movements" ("account_id")
        WHERE "account_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IX_investment_movements_account"`);
    await queryRunner.query(`
      ALTER TABLE "investment_movements"
        DROP COLUMN IF EXISTS "cash_transfer_group_id",
        DROP COLUMN IF EXISTS "account_id"
    `);
  }
}
