import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona o valor 'transfer' a transaction_direction_enum (movimento neutro: não conta
 * como receita/despesa, mas afeta o saldo da conta). Ver ADR adr-transfer-type-and-fixed-income.
 *
 * ADD VALUE não é reversível em PostgreSQL (down no-op documentado, padrão das migrations
 * de enum deste repo). Roda fora de transação porque ADD VALUE não pode ser usado na mesma
 * transação em que foi criado — e a migration seguinte (029) já usa o valor.
 */
export class TransactionTransferDirection1770000000028 implements MigrationInterface {
  name = 'TransactionTransferDirection1770000000028';

  public transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query(`
      ALTER TYPE "public"."transaction_direction_enum" ADD VALUE IF NOT EXISTS 'transfer'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    /* Valor 'transfer' permanece — remoção exigiria recriar transaction_direction_enum. */
  }
}
