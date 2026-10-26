import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Organizações (multi-tenant), memberships e plano Free/Pro/Plus.
 * Backfill: uma organização "Casa" + owner para cada utilizador activo; todas as linhas existentes recebem essa org.
 */
export class AddOrganizationsAndPlans1770000000003 implements MigrationInterface {
  name = 'AddOrganizationsAndPlans1770000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."organization_plan_enum" AS ENUM('free', 'pro', 'plus')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."organization_membership_role_enum" AS ENUM('owner', 'admin', 'member')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."organization_membership_status_enum" AS ENUM('active', 'invited')
    `);

    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "name" character varying(128) NOT NULL,
        "plan" "public"."organization_plan_enum" NOT NULL DEFAULT 'free',
        CONSTRAINT "PK_organizations_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_organizations_plan" ON "organizations" ("plan")`);

    await queryRunner.query(`
      CREATE TABLE "organization_memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" "public"."organization_membership_role_enum" NOT NULL DEFAULT 'member',
        "status" "public"."organization_membership_status_enum" NOT NULL DEFAULT 'active',
        CONSTRAINT "PK_organization_memberships_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_organization_memberships_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_organization_memberships_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_organization_memberships_org_user" UNIQUE ("organization_id", "user_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_organization_memberships_user_id" ON "organization_memberships" ("user_id")`,
    );

    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN "organization_id" uuid`);
    await queryRunner.query(`ALTER TABLE "categories" ADD COLUMN "organization_id" uuid`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN "organization_id" uuid`);
    await queryRunner.query(`ALTER TABLE "category_budgets" ADD COLUMN "organization_id" uuid`);
    await queryRunner.query(`ALTER TABLE "monthly_budgets" ADD COLUMN "organization_id" uuid`);
    await queryRunner.query(`ALTER TABLE "projections" ADD COLUMN "organization_id" uuid`);
    await queryRunner.query(`ALTER TABLE "settings" ADD COLUMN "organization_id" uuid`);
    await queryRunner.query(`ALTER TABLE "investment_movements" ADD COLUMN "organization_id" uuid`);
    await queryRunner.query(`ALTER TABLE "whatsapp_events" ADD COLUMN "organization_id" uuid`);
    await queryRunner.query(`ALTER TABLE "whatsapp_sessions" ADD COLUMN "organization_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_sessions" ADD COLUMN "organization_id" uuid`,
    );

    const inserted = (await queryRunner.query(
      `INSERT INTO "organizations" ("name", "plan") VALUES ('Casa', 'free') RETURNING "id"`,
    )) as Array<{ id: string }>;
    const defaultOrgId = inserted[0]?.id;
    if (!defaultOrgId) {
      throw new Error('AddOrganizationsAndPlans: failed to create default organization');
    }

    await queryRunner.query(
      `
      INSERT INTO "organization_memberships" ("organization_id", "user_id", "role", "status")
      SELECT $1::uuid, u."id", 'owner', 'active'
      FROM "users" u
      WHERE u."deleted_at" IS NULL AND u."is_active" = true
    `,
      [defaultOrgId],
    );

    await queryRunner.query(
      `UPDATE "accounts" SET "organization_id" = $1 WHERE "organization_id" IS NULL`,
      [defaultOrgId],
    );
    await queryRunner.query(
      `UPDATE "categories" SET "organization_id" = $1 WHERE "organization_id" IS NULL`,
      [defaultOrgId],
    );
    await queryRunner.query(
      `UPDATE "transactions" SET "organization_id" = $1 WHERE "organization_id" IS NULL`,
      [defaultOrgId],
    );
    await queryRunner.query(
      `UPDATE "category_budgets" SET "organization_id" = $1 WHERE "organization_id" IS NULL`,
      [defaultOrgId],
    );
    await queryRunner.query(
      `UPDATE "monthly_budgets" SET "organization_id" = $1 WHERE "organization_id" IS NULL`,
      [defaultOrgId],
    );
    await queryRunner.query(
      `UPDATE "projections" SET "organization_id" = $1 WHERE "organization_id" IS NULL`,
      [defaultOrgId],
    );
    await queryRunner.query(
      `UPDATE "settings" SET "organization_id" = $1 WHERE "organization_id" IS NULL`,
      [defaultOrgId],
    );
    await queryRunner.query(
      `UPDATE "investment_movements" SET "organization_id" = $1 WHERE "organization_id" IS NULL`,
      [defaultOrgId],
    );
    await queryRunner.query(
      `UPDATE "whatsapp_events" SET "organization_id" = $1 WHERE "organization_id" IS NULL`,
      [defaultOrgId],
    );
    await queryRunner.query(
      `UPDATE "whatsapp_sessions" SET "organization_id" = $1 WHERE "organization_id" IS NULL`,
      [defaultOrgId],
    );
    await queryRunner.query(
      `UPDATE "ai_conversation_sessions" SET "organization_id" = $1 WHERE "organization_id" IS NULL`,
      [defaultOrgId],
    );

    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "organization_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "categories" ALTER COLUMN "organization_id" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "organization_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_budgets" ALTER COLUMN "organization_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "monthly_budgets" ALTER COLUMN "organization_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "projections" ALTER COLUMN "organization_id" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "settings" ALTER COLUMN "organization_id" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "investment_movements" ALTER COLUMN "organization_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_events" ALTER COLUMN "organization_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_sessions" ALTER COLUMN "organization_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_sessions" ALTER COLUMN "organization_id" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "accounts" ADD CONSTRAINT "FK_accounts_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_budgets" ADD CONSTRAINT "FK_category_budgets_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "monthly_budgets" ADD CONSTRAINT "FK_monthly_budgets_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projections" ADD CONSTRAINT "FK_projections_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "settings" ADD CONSTRAINT "FK_settings_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "investment_movements" ADD CONSTRAINT "FK_investment_movements_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_events" ADD CONSTRAINT "FK_whatsapp_events_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "FK_whatsapp_sessions_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_sessions" ADD CONSTRAINT "FK_ai_conversation_sessions_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION`,
    );

    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "UQ_accounts_name"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_accounts_organization_name"
      ON "accounts" ("organization_id", "name")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "UQ_categories_name"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_categories_organization_name"
      ON "categories" ("organization_id", "name")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_category_budgets_all"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_category_budgets_user"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_category_budgets_all"
      ON "category_budgets" ("organization_id", "period", "category_id")
      WHERE "scope_user_id" IS NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_category_budgets_user"
      ON "category_budgets" ("organization_id", "period", "category_id", "scope_user_id")
      WHERE "scope_user_id" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_monthly_budgets_all"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_monthly_budgets_user"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_monthly_budgets_all"
      ON "monthly_budgets" ("organization_id", "period")
      WHERE "scope_user_id" IS NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_monthly_budgets_user"
      ON "monthly_budgets" ("organization_id", "period", "scope_user_id")
      WHERE "scope_user_id" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_settings_key_global"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_settings_key_user"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_settings_key_global"
      ON "settings" ("organization_id", "key")
      WHERE "scope_user_id" IS NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_settings_key_user"
      ON "settings" ("organization_id", "key", "scope_user_id")
      WHERE "scope_user_id" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "ai_conversation_sessions" DROP CONSTRAINT IF EXISTS "UQ_ai_session_user_channel_date"`,
    );
    await queryRunner.query(`
      ALTER TABLE "ai_conversation_sessions"
      ADD CONSTRAINT "UQ_ai_session_org_user_channel_date" UNIQUE ("organization_id", "user_id", "channel", "session_date")
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_accounts_organization_id" ON "accounts" ("organization_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_categories_organization_id" ON "categories" ("organization_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_organization_occurred" ON "transactions" ("organization_id", "occurred_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_projections_organization_period" ON "projections" ("organization_id", "period_start")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_events_organization_created" ON "whatsapp_events" ("organization_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_whatsapp_events_organization_created"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_projections_organization_period"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_transactions_organization_occurred"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_categories_organization_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_accounts_organization_id"`);

    await queryRunner.query(
      `ALTER TABLE "ai_conversation_sessions" DROP CONSTRAINT IF EXISTS "UQ_ai_session_org_user_channel_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversation_sessions" DROP CONSTRAINT IF EXISTS "FK_ai_conversation_sessions_organization"`,
    );
    await queryRunner.query(`ALTER TABLE "ai_conversation_sessions" DROP COLUMN "organization_id"`);
    await queryRunner.query(`
      ALTER TABLE "ai_conversation_sessions"
      ADD CONSTRAINT "UQ_ai_session_user_channel_date" UNIQUE ("user_id", "channel", "session_date")
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_settings_key_global"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_settings_key_user"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_settings_key_global" ON "settings" ("key")
      WHERE "scope_user_id" IS NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_settings_key_user" ON "settings" ("key", "scope_user_id")
      WHERE "scope_user_id" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_monthly_budgets_all"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_monthly_budgets_user"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_monthly_budgets_all" ON "monthly_budgets" ("period")
      WHERE "scope_user_id" IS NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_monthly_budgets_user" ON "monthly_budgets" ("period", "scope_user_id")
      WHERE "scope_user_id" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_category_budgets_all"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_category_budgets_user"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_category_budgets_all" ON "category_budgets" ("period", "category_id")
      WHERE "scope_user_id" IS NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_category_budgets_user" ON "category_budgets" ("period", "category_id", "scope_user_id")
      WHERE "scope_user_id" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_categories_organization_name"`);
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "UQ_categories_name" UNIQUE ("name")`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_accounts_organization_name"`);
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD CONSTRAINT "UQ_accounts_name" UNIQUE ("name")`,
    );

    await queryRunner.query(
      `ALTER TABLE "whatsapp_sessions" DROP CONSTRAINT IF EXISTS "FK_whatsapp_sessions_organization"`,
    );
    await queryRunner.query(`ALTER TABLE "whatsapp_sessions" DROP COLUMN "organization_id"`);

    await queryRunner.query(
      `ALTER TABLE "whatsapp_events" DROP CONSTRAINT IF EXISTS "FK_whatsapp_events_organization"`,
    );
    await queryRunner.query(`ALTER TABLE "whatsapp_events" DROP COLUMN "organization_id"`);

    await queryRunner.query(
      `ALTER TABLE "investment_movements" DROP CONSTRAINT IF EXISTS "FK_investment_movements_organization"`,
    );
    await queryRunner.query(`ALTER TABLE "investment_movements" DROP COLUMN "organization_id"`);

    await queryRunner.query(
      `ALTER TABLE "settings" DROP CONSTRAINT IF EXISTS "FK_settings_organization"`,
    );
    await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "organization_id"`);

    await queryRunner.query(
      `ALTER TABLE "projections" DROP CONSTRAINT IF EXISTS "FK_projections_organization"`,
    );
    await queryRunner.query(`ALTER TABLE "projections" DROP COLUMN "organization_id"`);

    await queryRunner.query(
      `ALTER TABLE "monthly_budgets" DROP CONSTRAINT IF EXISTS "FK_monthly_budgets_organization"`,
    );
    await queryRunner.query(`ALTER TABLE "monthly_budgets" DROP COLUMN "organization_id"`);

    await queryRunner.query(
      `ALTER TABLE "category_budgets" DROP CONSTRAINT IF EXISTS "FK_category_budgets_organization"`,
    );
    await queryRunner.query(`ALTER TABLE "category_budgets" DROP COLUMN "organization_id"`);

    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_organization"`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "organization_id"`);

    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "FK_categories_organization"`,
    );
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "organization_id"`);

    await queryRunner.query(
      `ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "FK_accounts_organization"`,
    );
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "organization_id"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "organization_memberships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "public"."organization_membership_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."organization_membership_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."organization_plan_enum"`);
  }
}
