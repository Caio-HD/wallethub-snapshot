import { MigrationInterface, QueryRunner } from 'typeorm';

export class DebtsAndInstallments1770000000016 implements MigrationInterface {
  name = 'DebtsAndInstallments1770000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."debt_kind_enum" AS ENUM('installment')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."debt_status_enum" AS ENUM('active', 'paid_off', 'paused')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."debt_installment_status_enum" AS ENUM('pending', 'paid', 'skipped')
    `);

    await queryRunner.query(`
      CREATE TABLE "debts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "name" character varying(128) NOT NULL,
        "creditor" character varying(128),
        "kind" "public"."debt_kind_enum" NOT NULL DEFAULT 'installment',
        "status" "public"."debt_status_enum" NOT NULL DEFAULT 'active',
        "principal_amount" numeric(12,2) NOT NULL,
        "installment_amount" numeric(12,2) NOT NULL,
        "total_installments" integer NOT NULL,
        "start_date" date NOT NULL,
        "category_id" uuid NOT NULL,
        "account_id" uuid,
        "notes" text,
        CONSTRAINT "PK_debts_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_debts_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_debts_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION,
        CONSTRAINT "FK_debts_account" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_debts_org_status" ON "debts" ("organization_id", "status") WHERE "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "debt_installments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "debt_id" uuid NOT NULL,
        "sequence_number" integer NOT NULL,
        "due_date" date NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "status" "public"."debt_installment_status_enum" NOT NULL DEFAULT 'pending',
        "transaction_id" uuid,
        "paid_at" TIMESTAMP,
        CONSTRAINT "PK_debt_installments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_debt_installments_debt" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_debt_installments_tx" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_debt_installments_debt_seq" UNIQUE ("debt_id", "sequence_number")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_debt_installments_debt_due" ON "debt_installments" ("debt_id", "due_date") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_debt_installments_transaction_id"
      ON "debt_installments" ("transaction_id")
      WHERE "transaction_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_debt_installments_transaction_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_debt_installments_debt_due"`);
    await queryRunner.query(`DROP TABLE "debt_installments"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_debts_org_status"`);
    await queryRunner.query(`DROP TABLE "debts"`);
    await queryRunner.query(`DROP TYPE "public"."debt_installment_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."debt_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."debt_kind_enum"`);
  }
}
