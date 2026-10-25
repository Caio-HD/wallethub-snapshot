import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pernas (legs) de transferência: liga as duas pontas de um transfer e marca o sentido do
 * fluxo de caixa para o saldo manter o sinal correto. Ver ADR adr-transfer-type-and-fixed-income.
 *
 * - transfer_group_id (uuid, nullable): agrupa as legs de uma mesma transferência. NULL para
 *   transações income/expense normais; leg único (ex.: fatura externa, abertura de saldo) tem
 *   group próprio sem contraparte.
 * - transfer_leg (enum out|in, nullable): 'out' debita a conta (saldo −), 'in' credita (saldo +).
 *   NULL quando direction <> 'transfer'.
 */
export class TransactionTransferGroup1770000000029 implements MigrationInterface {
  name = 'TransactionTransferGroup1770000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_transfer_leg_enum') THEN
          CREATE TYPE "public"."transaction_transfer_leg_enum" AS ENUM ('out', 'in');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD COLUMN IF NOT EXISTS "transfer_group_id" uuid,
        ADD COLUMN IF NOT EXISTS "transfer_leg" "public"."transaction_transfer_leg_enum"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IX_transactions_transfer_group"
        ON "transactions" ("transfer_group_id")
        WHERE "transfer_group_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IX_transactions_transfer_group"`);
    await queryRunner.query(`
      ALTER TABLE "transactions"
        DROP COLUMN IF EXISTS "transfer_leg",
        DROP COLUMN IF EXISTS "transfer_group_id"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."transaction_transfer_leg_enum"`);
  }
}
