import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountBalanceAdjustment1770000000001 implements MigrationInterface {
  name = 'AccountBalanceAdjustment1770000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add last_balance_update_at
    await queryRunner.query(`ALTER TABLE "accounts" ADD "last_balance_update_at" TIMESTAMP`);

    // 2. Ensure "Ajuste de Saldo" categories exist
    const adminUser = (await queryRunner.query(
      `SELECT id FROM "users" WHERE "role" = 'admin' ORDER BY created_at ASC LIMIT 1`,
    )) as { id: string }[];
    const adminId = adminUser[0]?.id;

    if (adminId) {
      await queryRunner.query(`
        INSERT INTO "categories" ("id", "name", "type", "is_active", "sort_order", "created_by_id", "created_at", "updated_at")
        SELECT uuid_generate_v4(), 'Ajuste de Saldo (Entrada)', 'income', true, 999, '${adminId}', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "name" = 'Ajuste de Saldo (Entrada)')
      `);
      await queryRunner.query(`
        INSERT INTO "categories" ("id", "name", "type", "is_active", "sort_order", "created_by_id", "created_at", "updated_at")
        SELECT uuid_generate_v4(), 'Ajuste de Saldo (Saída)', 'expense', true, 1000, '${adminId}', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "name" = 'Ajuste de Saldo (Saída)')
      `);
    }

    const catInc = (await queryRunner.query(
      `SELECT id FROM "categories" WHERE "name" = 'Ajuste de Saldo (Entrada)' LIMIT 1`,
    )) as { id: string }[];
    const catExp = (await queryRunner.query(
      `SELECT id FROM "categories" WHERE "name" = 'Ajuste de Saldo (Saída)' LIMIT 1`,
    )) as { id: string }[];
    const catIncId = catInc[0]?.id;
    const catExpId = catExp[0]?.id;

    // 3. Convert initial_balance to transactions
    const accounts = (await queryRunner.query(
      `SELECT id, initial_balance, owner_user_ids FROM "accounts" WHERE initial_balance <> 0`,
    )) as { id: string; initial_balance: string; owner_user_ids: string[] | null }[];

    for (const acc of accounts) {
      const amount = parseFloat(acc.initial_balance);
      const userId = acc.owner_user_ids?.[0] || adminId;
      if (!userId) continue;

      if (amount > 0 && catIncId) {
        await queryRunner.query(`
          INSERT INTO "transactions" ("id", "occurred_at", "account_id", "category_id", "user_id", "direction", "amount", "source", "created_at", "updated_at")
          VALUES (uuid_generate_v4(), NOW(), '${acc.id}', '${catIncId}', '${userId}', 'income', ${amount}, 'web', NOW(), NOW())
        `);
      } else if (amount < 0 && catExpId) {
        await queryRunner.query(`
          INSERT INTO "transactions" ("id", "occurred_at", "account_id", "category_id", "user_id", "direction", "amount", "source", "created_at", "updated_at")
          VALUES (uuid_generate_v4(), NOW(), '${acc.id}', '${catExpId}', '${userId}', 'expense', ${Math.abs(amount)}, 'web', NOW(), NOW())
        `);
      }

      await queryRunner.query(
        `UPDATE "accounts" SET "last_balance_update_at" = NOW() WHERE "id" = '${acc.id}'`,
      );
    }

    // 4. Drop initial_balance column
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "initial_balance"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD "initial_balance" numeric(12,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "last_balance_update_at"`);
  }
}
