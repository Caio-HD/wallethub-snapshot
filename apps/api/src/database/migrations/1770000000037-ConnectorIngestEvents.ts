import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ledger durável da ingestão do Zenrick Connector (ADR adr-zenrick-connector §5):
 * uma linha por Idempotency-Key recebida, com status, tentativas e a resposta
 * devolvida — dá replay determinístico após o TTL do Redis, DLQ lógico
 * (parar de reprocessar após N tentativas) e trilha de auditoria local
 * ("o que aconteceu com o e-mail X?").
 *
 * Aditiva e idempotente; rollback = drop da tabela.
 */
export class ConnectorIngestEvents1770000000037 implements MigrationInterface {
  name = 'ConnectorIngestEvents1770000000037';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "connector_ingest_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "idempotency_key" varchar(128) NOT NULL,
        "status" varchar(16) NOT NULL,
        "attempts" int NOT NULL DEFAULT 1,
        "last_error" text,
        "batch_id" uuid,
        "response" jsonb,
        CONSTRAINT "PK_connector_ingest_events" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cie_org_idempotency_key" UNIQUE ("organization_id", "idempotency_key")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IX_cie_org_created" ON "connector_ingest_events" ("organization_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;
    await queryRunner.query(`DROP TABLE IF EXISTS "connector_ingest_events"`);
  }
}
