import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Perfil fiscal opcional em organizations; RAG pessoal escopado por organization_id + owner_user_id.
 */
export class OrganizationTaxProfileAndRagOrgScope1770000000006 implements MigrationInterface {
  name = 'OrganizationTaxProfileAndRagOrgScope1770000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."organization_tax_id_type_enum" AS ENUM('cpf', 'cnpj')
    `);
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN "legal_name" character varying(256),
      ADD COLUMN "tax_id_type" "public"."organization_tax_id_type_enum",
      ADD COLUMN "tax_id" character varying(20)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_organizations_tax_id"
      ON "organizations" ("tax_id")
      WHERE "tax_id" IS NOT NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_organizations_created_at" ON "organizations" ("created_at")
    `);

    await queryRunner.query(`ALTER TABLE "rag_documents" ADD COLUMN "organization_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "rag_documents"
      ADD CONSTRAINT "FK_rag_documents_organization"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      UPDATE "rag_documents" d
      SET "organization_id" = sub.org_id
      FROM (
        SELECT DISTINCT ON (m."user_id") m."user_id" AS uid, m."organization_id" AS org_id
        FROM "organization_memberships" m
        WHERE m."status" = 'active' AND m."deleted_at" IS NULL
        ORDER BY m."user_id", m."created_at" ASC
      ) AS sub
      WHERE d."owner_user_id" IS NOT NULL
        AND d."owner_user_id" = sub.uid
        AND d."organization_id" IS NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_rag_documents_source_key_global"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_rag_documents_source_key_user"`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_rag_documents_source_key_global"
      ON "rag_documents" ("source_key")
      WHERE "owner_user_id" IS NULL AND "organization_id" IS NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_rag_documents_source_key_org_user"
      ON "rag_documents" ("organization_id", "owner_user_id", "source_key")
      WHERE "owner_user_id" IS NOT NULL
        AND "organization_id" IS NOT NULL
        AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_rag_documents_organization_id" ON "rag_documents" ("organization_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_rag_documents_organization_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_rag_documents_source_key_org_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_rag_documents_source_key_global"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_rag_documents_source_key_global"
      ON "rag_documents" ("source_key")
      WHERE "owner_user_id" IS NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_rag_documents_source_key_user"
      ON "rag_documents" ("owner_user_id", "source_key")
      WHERE "owner_user_id" IS NOT NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "rag_documents" DROP CONSTRAINT IF EXISTS "FK_rag_documents_organization"`,
    );
    await queryRunner.query(`ALTER TABLE "rag_documents" DROP COLUMN IF EXISTS "organization_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_organizations_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_organizations_tax_id"`);
    await queryRunner.query(`
      ALTER TABLE "organizations" DROP COLUMN IF EXISTS "tax_id",
      DROP COLUMN IF EXISTS "tax_id_type",
      DROP COLUMN IF EXISTS "legal_name"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."organization_tax_id_type_enum"`);
  }
}
