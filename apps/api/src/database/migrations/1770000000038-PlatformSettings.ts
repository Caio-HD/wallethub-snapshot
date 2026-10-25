import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformSettings1770000000038 implements MigrationInterface {
  name = 'PlatformSettings1770000000038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Configuração global da plataforma (super-admin), mutável em runtime.
    // Aditiva e não-destrutiva. Escopo único/global (uma linha por `key`).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" varchar(128) NOT NULL,
        "value" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "UQ_platform_settings_key" UNIQUE ("key")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_settings"`);
  }
}
