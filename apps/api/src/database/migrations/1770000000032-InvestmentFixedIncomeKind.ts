import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona o valor 'fixed_income' a investment_instrument_kind_enum (renda fixa: RDB/CDB/Tesouro
 * sem ticker/cotação de mercado; valor = principal aportado − resgatado + rendimento lançado).
 * Ver ADR adr-transfer-type-and-fixed-income.
 *
 * ADD VALUE é irreversível em PostgreSQL (down no-op) e roda fora de transação.
 */
export class InvestmentFixedIncomeKind1770000000032 implements MigrationInterface {
  name = 'InvestmentFixedIncomeKind1770000000032';

  public transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query(`
      ALTER TYPE "public"."investment_instrument_kind_enum" ADD VALUE IF NOT EXISTS 'fixed_income'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    /* Valor 'fixed_income' permanece — remoção exigiria recriar o enum. */
  }
}
