import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds external_id (OFX FITID) with partial unique index per account.
 * Uses CREATE INDEX CONCURRENTLY — requires transaction = false.
 */
export class TransactionExternalId1770000000020 implements MigrationInterface {
  name = 'TransactionExternalId1770000000020';

  /** CONCURRENTLY cannot run inside a transaction block. */
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD COLUMN IF NOT EXISTS "external_id" varchar(255) NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_class c
          JOIN pg_index i ON i.indexrelid = c.oid
          WHERE c.relname = 'UQ_tx_account_external_id'
            AND NOT i.indisvalid
        ) THEN
          DROP INDEX CONCURRENTLY IF EXISTS "UQ_tx_account_external_id";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "UQ_tx_account_external_id"
      ON "transactions" ("account_id", "external_id")
      WHERE "external_id" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_class c
          JOIN pg_index i ON i.indexrelid = c.oid
          WHERE c.relname = 'IX_tx_account_occurred'
            AND NOT i.indisvalid
        ) THEN
          DROP INDEX CONCURRENTLY IF EXISTS "IX_tx_account_occurred";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_tx_account_occurred"
      ON "transactions" ("account_id", "occurred_at")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }

    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IX_tx_account_occurred"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "UQ_tx_account_external_id"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN IF EXISTS "external_id"`);
  }
}
