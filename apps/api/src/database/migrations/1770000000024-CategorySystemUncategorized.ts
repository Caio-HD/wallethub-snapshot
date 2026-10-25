import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Categorias de sistema "Sem categoria" (entradas/saídas) por organização — o
 * destino neutro de linhas de importação ainda não classificadas (loop de
 * aprendizado: categorizar depois ensina o mapeamento descrição→categoria).
 *
 * - Adiciona `categories.is_system` (flag de categoria gerida pelo sistema).
 * - Backfill: cria as 2 categorias de sistema para TODA organização existente.
 *   Idempotente via ON CONFLICT (organization_id, name).
 * Aditiva (sem CONCURRENTLY — sem índices novos pesados).
 */
export class CategorySystemUncategorized1770000000024 implements MigrationInterface {
  name = 'CategorySystemUncategorized1770000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "is_system" boolean NOT NULL DEFAULT false
    `);

    // Backfill: 1 categoria de sistema por (org, tipo). sort_order alto = aparece por último.
    await queryRunner.query(`
      INSERT INTO "categories" ("id", "organization_id", "name", "type", "is_system", "is_active", "sort_order")
      SELECT uuid_generate_v4(), o."id", 'Sem categoria (entradas)', 'income', true, true, 9999
      FROM "organizations" o
      ON CONFLICT ("organization_id", "name") WHERE "deleted_at" IS NULL DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "categories" ("id", "organization_id", "name", "type", "is_system", "is_active", "sort_order")
      SELECT uuid_generate_v4(), o."id", 'Sem categoria (saídas)', 'expense', true, true, 9999
      FROM "organizations" o
      ON CONFLICT ("organization_id", "name") WHERE "deleted_at" IS NULL DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }
    // Remove apenas as categorias de sistema sem transações associadas (segurança).
    await queryRunner.query(`
      DELETE FROM "categories" c
      WHERE c."is_system" = true
        AND c."name" IN ('Sem categoria (entradas)', 'Sem categoria (saídas)')
        AND NOT EXISTS (SELECT 1 FROM "transactions" t WHERE t."category_id" = c."id")
    `);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN IF EXISTS "is_system"`);
  }
}
