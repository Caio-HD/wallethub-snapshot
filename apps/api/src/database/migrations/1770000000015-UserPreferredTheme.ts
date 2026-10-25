import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPreferredTheme1770000000015 implements MigrationInterface {
  name = 'UserPreferredTheme1770000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "preferred_theme" varchar(16) DEFAULT 'dark'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "preferred_theme"`);
  }
}
