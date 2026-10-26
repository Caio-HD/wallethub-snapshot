import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona o valor 'connector' a transaction_source_enum — proveniência das transações
 * criadas pela ingestão S2S do ecossistema Zenrick (Kyron). Ver ADR adr-zenrick-connector.
 *
 * ADD VALUE não é reversível em PostgreSQL (down no-op documentado, padrão das migrations
 * de enum deste repo). Roda fora de transação porque ADD VALUE não pode ser usado na mesma
 * transação em que foi criado. Deve estar aplicada ANTES do deploy do código que a usa.
 */
export class TransactionSourceConnector1770000000035 implements MigrationInterface {
  name = 'TransactionSourceConnector1770000000035';

  public transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query(`
      ALTER TYPE "public"."transaction_source_enum" ADD VALUE IF NOT EXISTS 'connector'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    /* Valor 'connector' permanece — remoção exigiria recriar transaction_source_enum. */
  }
}
