import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona o valor 'transfer' a category_type_enum. Categorias de transferência são o destino
 * neutro das transações com direction='transfer' (mantém a regra direction = category.type).
 * Ver ADR adr-transfer-type-and-fixed-income.
 *
 * ADD VALUE é irreversível em PostgreSQL (down no-op) e roda fora de transação porque a
 * migration seguinte (031) já usa o valor no INSERT da categoria de sistema.
 */
export class CategoryTransferType1770000000030 implements MigrationInterface {
  name = 'CategoryTransferType1770000000030';

  public transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query(`
      ALTER TYPE "public"."category_type_enum" ADD VALUE IF NOT EXISTS 'transfer'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    /* Valor 'transfer' permanece — remoção exigiria recriar category_type_enum. */
  }
}
