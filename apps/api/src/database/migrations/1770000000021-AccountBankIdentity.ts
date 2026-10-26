import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds bank identity columns (OFX BANKID/BRANCHID/ACCTID) to accounts, with a
 * partial unique index per organization so an OFX file can be matched to a
 * single account by bank + branch + account number.
 * Uses CREATE INDEX CONCURRENTLY — requires transaction = false.
 */
export class AccountBankIdentity1770000000021 implements MigrationInterface {
  name = 'AccountBankIdentity1770000000021';

  /** CONCURRENTLY cannot run inside a transaction block. */
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "accounts"
        ADD COLUMN IF NOT EXISTS "bank_id" varchar(20) NULL,
        ADD COLUMN IF NOT EXISTS "branch_number" varchar(20) NULL,
        ADD COLUMN IF NOT EXISTS "account_number" varchar(40) NULL
    `);

    // Self-heal de um índice CONCURRENTLY que falhou no meio (indisvalid=false).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_class c
          JOIN pg_index i ON i.indexrelid = c.oid
          WHERE c.relname = 'UQ_account_bank_branch_number'
            AND NOT i.indisvalid
        ) THEN
          DROP INDEX CONCURRENTLY IF EXISTS "UQ_account_bank_branch_number";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "UQ_account_bank_branch_number"
      ON "accounts" ("organization_id", "bank_id", "branch_number", "account_number")
      WHERE "account_number" IS NOT NULL AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }

    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "UQ_account_bank_branch_number"`);
    await queryRunner.query(`
      ALTER TABLE "accounts"
        DROP COLUMN IF EXISTS "account_number",
        DROP COLUMN IF EXISTS "branch_number",
        DROP COLUMN IF EXISTS "bank_id"
    `);
  }
}
