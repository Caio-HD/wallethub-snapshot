import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Categoria de sistema "Transferências" (type='transfer') por organização — destino neutro
 * das transações de transferência (entre contas próprias, fatura externa, abertura de saldo).
 * Não conta como receita/despesa; afeta só o saldo. Ver ADR adr-transfer-type-and-fixed-income.
 *
 * Idempotente via ON CONFLICT (organization_id, name) WHERE deleted_at IS NULL (índice parcial).
 * Depende da migration 030 (valor 'transfer' no enum).
 */
export class SystemTransferCategory1770000000031 implements MigrationInterface {
  name = 'SystemTransferCategory1770000000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    await queryRunner.query(`
      INSERT INTO "categories" ("id", "organization_id", "name", "type", "is_system", "is_active", "sort_order")
      SELECT uuid_generate_v4(), o."id", 'Transferências', 'transfer', true, true, 9999
      FROM "organizations" o
      ON CONFLICT ("organization_id", "name") WHERE "deleted_at" IS NULL DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query(`
      DELETE FROM "categories" c
      WHERE c."is_system" = true
        AND c."name" = 'Transferências'
        AND NOT EXISTS (SELECT 1 FROM "transactions" t WHERE t."category_id" = c."id")
    `);
  }
}
