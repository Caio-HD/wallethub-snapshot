import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserBaseCurrency1770000000002 implements MigrationInterface {
  name = 'AddUserBaseCurrency1770000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "base_currency" character varying(3) NOT NULL DEFAULT 'BRL'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "base_currency"`);
  }
}
