import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Correção dos dados legados de extrato (BUG-39 e BUG-41).
 *
 * 1) "Pagamento de fatura" estava gravado como transfer leg 'out' (movimento neutro), o que
 *    tirava o consumo do cartão dos totais de despesa do painel. Como o cartão não é conta
 *    rastreada no WalletHub, o pagamento é consumo real da conta corrente: vira 'expense'.
 *    Nenhuma das 25 pernas tem contraparte 'in' no mesmo grupo, então a conversão não
 *    duplica nem distorce o saldo — o valor sai igual, só muda de categoria de contagem.
 *
 * 2) O "Ajuste de saldo manual" (R$ 15.314,07, 27/06/2026) foi criado pela tela de conta
 *    para forçar a conciliação de junho, e é a origem de um saldo que não bate com o banco.
 *    Vira "Saldo de abertura": mesma perna neutra, mesma data, mesmo valor, mas com
 *    external_id determinístico para a abertura de saldo não ser recriada. NÃO é removido:
 *    apagar a perna derrubaria o saldo da conta em R$ 15.314,07.
 *
 * Idempotente: rodar duas vezes não muda nada.
 */
export class FixLegacyStatementBalances1770000000039 implements MigrationInterface {
  name = 'FixLegacyStatementBalances1770000000039';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    await queryRunner.query(`
      UPDATE "transactions" t
      SET
        "direction" = 'expense',
        "category_id" = (
          SELECT c."id" FROM "categories" c
          WHERE c."organization_id" = t."organization_id" AND c."type" = 'expense' AND c."is_system" = true
          ORDER BY c."name"
          LIMIT 1
        ),
        "transfer_leg" = NULL,
        "transfer_group_id" = NULL,
        "updated_at" = now()
      WHERE t."deleted_at" IS NULL
        AND t."direction" = 'transfer'
        AND t."description" ILIKE '%pagamento de fatura%'
        AND NOT EXISTS (
          SELECT 1 FROM "transactions" o
          WHERE o."transfer_group_id" = t."transfer_group_id"
            AND o."transfer_leg" = 'in'
            AND o."deleted_at" IS NULL
        )
        AND t."category_id" IS NOT DISTINCT FROM (
          SELECT c."id" FROM "categories" c
          WHERE c."organization_id" = t."organization_id" AND c."type" = 'transfer' AND c."is_system" = true
          ORDER BY c."name" LIMIT 1
        )
    `);

    await queryRunner.query(`
      UPDATE "transactions"
      SET
        "description" = 'Saldo de abertura',
        "external_id" = 'OPENING_BAL_' || "account_id"::text,
        "updated_at" = now()
      WHERE "deleted_at" IS NULL
        AND "description" = 'Ajuste de saldo manual'
        AND "direction" = 'transfer'
        AND "external_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    await queryRunner.query(`
      UPDATE "transactions" t
      SET
        "direction" = 'transfer',
        "category_id" = (
          SELECT c."id" FROM "categories" c
          WHERE c."organization_id" = t."organization_id" AND c."type" = 'transfer' AND c."is_system" = true
          ORDER BY c."name" LIMIT 1
        ),
        "transfer_leg" = 'out',
        "updated_at" = now()
      WHERE t."deleted_at" IS NULL
        AND t."direction" = 'expense'
        AND t."description" ILIKE '%pagamento de fatura%'
    `);

    await queryRunner.query(`
      UPDATE "transactions"
      SET
        "description" = 'Ajuste de saldo manual',
        "external_id" = NULL,
        "updated_at" = now()
      WHERE "deleted_at" IS NULL
        AND "description" = 'Saldo de abertura'
        AND "external_id" LIKE 'OPENING_BAL_%'
    `);
  }
}
