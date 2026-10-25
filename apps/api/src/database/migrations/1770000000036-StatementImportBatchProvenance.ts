import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Proveniência externa dos lotes de importação de extrato (ADR adr-zenrick-connector):
 *  - origin: canal que originou o lote ('web' | 'connector').
 *  - provenance: metadados da origem (extractor, messageIdHash, receivedAt) — NUNCA
 *    remetente, assunto ou corpo de e-mail (LGPD).
 *
 * Aditiva e idempotente; rollback = drop das colunas.
 */
export class StatementImportBatchProvenance1770000000036 implements MigrationInterface {
  name = 'StatementImportBatchProvenance1770000000036';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query(`
      ALTER TABLE "statement_import_batches"
        ADD COLUMN IF NOT EXISTS "origin" varchar(20) NOT NULL DEFAULT 'web',
        ADD COLUMN IF NOT EXISTS "provenance" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query(`
      ALTER TABLE "statement_import_batches"
        DROP COLUMN IF EXISTS "provenance",
        DROP COLUMN IF EXISTS "origin"
    `);
  }
}
