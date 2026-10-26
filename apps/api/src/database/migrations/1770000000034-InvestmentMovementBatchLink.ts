import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Liga um movimento de investimento ao lote de importação de extrato que o criou (RDB detectado
 * no OFX). Permite que `deleteBatch` remova os movimentos junto com as transações do lote — assim
 * o fluxo "deletar lote + reimportar" fica limpo (sem órfãos nem duplicatas).
 * Ver ADR adr-transfer-type-and-fixed-income.
 */
export class InvestmentMovementBatchLink1770000000034 implements MigrationInterface {
  name = 'InvestmentMovementBatchLink1770000000034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    await queryRunner.query(`
      ALTER TABLE "investment_movements"
        ADD COLUMN IF NOT EXISTS "statement_import_batch_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IX_investment_movements_batch"
        ON "investment_movements" ("statement_import_batch_id")
        WHERE "statement_import_batch_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IX_investment_movements_batch"`);
    await queryRunner.query(`
      ALTER TABLE "investment_movements" DROP COLUMN IF EXISTS "statement_import_batch_id"
    `);
  }
}
