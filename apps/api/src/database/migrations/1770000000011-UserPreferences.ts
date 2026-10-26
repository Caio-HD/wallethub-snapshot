import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPreferences1770000000011 implements MigrationInterface {
  name = 'UserPreferences1770000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "preferred_language" varchar(10) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "timezone" varchar(64) DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "preferred_language"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "timezone"`);
  }
}
