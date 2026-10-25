import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Auditoria de importação de extrato (OFX/CSV):
 *  - statement_import_batches: lote por commit de importação (agrupa transações).
 *  - statement_category_mappings: memória descrição→categoria por organização.
 *  - transactions.statement_import_batch_id: FK ON DELETE SET NULL (a exclusão do
 *    lote NÃO apaga transações em cascata — o serviço faz soft-delete explícito,
 *    respeitando o bloqueio de transações ligadas a dívidas).
 *
 * Aditiva. CONCURRENTLY (transaction=false) para não travar a tabela transactions.
 * Idempotente (IF NOT EXISTS + self-heal de índices indisvalid).
 */
export class StatementImportAudit1770000000023 implements MigrationInterface {
  name = 'StatementImportAudit1770000000023';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }

    // enum do formato (idempotente)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statement_import_format') THEN
          CREATE TYPE "statement_import_format" AS ENUM ('csv', 'ofx');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "statement_import_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "account_id" uuid NOT NULL,
        "created_by_user_id" uuid,
        "filename" varchar(255) NOT NULL,
        "format" "statement_import_format" NOT NULL,
        "file_hash" varchar(64) NOT NULL,
        "detected_bank_id" varchar(20),
        "transaction_count" integer NOT NULL DEFAULT 0,
        "skipped_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_statement_import_batches" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IX_sib_org_created"
      ON "statement_import_batches" ("organization_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IX_sib_account"
      ON "statement_import_batches" ("account_id")
    `);

    // dedup em nível de arquivo: 1 lote ativo por (org, conta, file_hash)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
          WHERE c.relname = 'UQ_sib_org_account_filehash' AND NOT i.indisvalid
        ) THEN
          DROP INDEX CONCURRENTLY IF EXISTS "UQ_sib_org_account_filehash";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "UQ_sib_org_account_filehash"
      ON "statement_import_batches" ("organization_id", "account_id", "file_hash")
      WHERE "deleted_at" IS NULL
    `);

    // memória descrição→categoria
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "statement_category_mappings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "description_key" varchar(200) NOT NULL,
        "description_sample" varchar(255) NOT NULL,
        "category_id" uuid NOT NULL,
        CONSTRAINT "PK_statement_category_mappings" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IX_scm_org" ON "statement_category_mappings" ("organization_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_scm_org_desc"
      ON "statement_category_mappings" ("organization_id", "description_key")
    `);

    // vínculo transação→lote (SET NULL na exclusão do lote)
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD COLUMN IF NOT EXISTS "statement_import_batch_id" uuid NULL
    `);
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_tx_statement_import_batch"
      ON "transactions" ("statement_import_batch_id")
      WHERE "statement_import_batch_id" IS NOT NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_tx_statement_import_batch'
        ) THEN
          ALTER TABLE "transactions"
          ADD CONSTRAINT "FK_tx_statement_import_batch"
          FOREIGN KEY ("statement_import_batch_id")
          REFERENCES "statement_import_batches" ("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }
    await queryRunner.query(`
      ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_tx_statement_import_batch"
    `);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IX_tx_statement_import_batch"`);
    await queryRunner.query(`
      ALTER TABLE "transactions" DROP COLUMN IF EXISTS "statement_import_batch_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "statement_category_mappings"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "UQ_sib_org_account_filehash"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "statement_import_batches"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "statement_import_format"`);
  }
}
