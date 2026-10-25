import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema inicial único: substitui migrations incrementais anteriores.
 * Alinhado às entidades TypeORM atuais (`accounts.owner_user_ids`, categorias/settings com
 * `owner_user_id` / `scope_user_id`; RAG com `rag_documents.owner_user_id`; investimentos).
 *
 * Inclui: extensão `vector` (pgvector), RAG (`rag_*`), tracing do agente (`ai_*`),
 * tabelas `investment_*`.
 * Bases já migradas com ficheiros antigos: fazer reset do volume Postgres ou dropar schema
 * antes de aplicar esta migration.
 */
export class InitialWalletHubSchema1770000000000 implements MigrationInterface {
  name = 'InitialWalletHubSchema1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(`
      CREATE TYPE "public"."category_type_enum" AS ENUM('income', 'expense')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."transaction_direction_enum" AS ENUM('income', 'expense')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."transaction_source_enum" AS ENUM('web', 'whatsapp')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."projection_trend_enum" AS ENUM('up', 'flat', 'down')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."whatsapp_sessions_status_enum" AS ENUM('unknown', 'qr', 'connected', 'disconnected')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."whatsapp_event_direction_enum" AS ENUM('inbound', 'outbound')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."whatsapp_event_status_enum" AS ENUM('received', 'processed', 'failed')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."ai_channel_enum" AS ENUM('web', 'whatsapp')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."ai_trace_status_enum" AS ENUM('running', 'completed', 'failed')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."ai_observation_type_enum" AS ENUM('user_message', 'llm', 'tool', 'retrieval', 'mcp')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."investment_market_enum" AS ENUM('BR', 'INTL')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."investment_instrument_kind_enum" AS ENUM('stock', 'fii', 'etf', 'other')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."investment_movement_kind_enum" AS ENUM('buy', 'sell', 'dividend')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "email" character varying,
        "username" character varying NOT NULL,
        "name" character varying NOT NULL,
        "phone_number" character varying NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "password_hash" character varying NOT NULL,
        "photo_url" character varying,
        "role" character varying NOT NULL DEFAULT 'admin',
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_phone_number" UNIQUE ("phone_number"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_username" ON "users" ("username")`);

    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "name" character varying NOT NULL,
        "owner_user_ids" uuid array,
        "initial_balance" numeric(12,2) NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_accounts_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_accounts_name" UNIQUE ("name")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_accounts_owner_user_ids" ON "accounts" USING GIN ("owner_user_ids")
    `);

    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "name" character varying NOT NULL,
        "type" "public"."category_type_enum" NOT NULL DEFAULT 'expense',
        "owner_user_id" uuid,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_by_id" uuid,
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_categories_name" UNIQUE ("name"),
        CONSTRAINT "FK_categories_created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_categories_owner_user" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_categories_name" ON "categories" ("name")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_categories_owner_user_id" ON "categories" ("owner_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_categories_created_by_id" ON "categories" ("created_by_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "key" character varying NOT NULL,
        "value" jsonb NOT NULL,
        "scope_user_id" uuid,
        CONSTRAINT "PK_settings_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_settings_scope_user" FOREIGN KEY ("scope_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_settings_key" ON "settings" ("key")`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_settings_key_global" ON "settings" ("key")
      WHERE "scope_user_id" IS NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_settings_key_user" ON "settings" ("key", "scope_user_id")
      WHERE "scope_user_id" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "whatsapp_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "session_name" character varying NOT NULL,
        "status" "public"."whatsapp_sessions_status_enum" NOT NULL DEFAULT 'unknown',
        "auth_state" jsonb,
        "last_connected_at" TIMESTAMP,
        "last_qr" text,
        "metadata" jsonb,
        CONSTRAINT "PK_whatsapp_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_whatsapp_sessions_session_name" UNIQUE ("session_name")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_sessions_session_name" ON "whatsapp_sessions" ("session_name")`,
    );

    await queryRunner.query(`
      CREATE TABLE "whatsapp_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "provider_message_id" character varying NOT NULL,
        "from_number" character varying NOT NULL,
        "direction" "public"."whatsapp_event_direction_enum" NOT NULL,
        "payload" jsonb NOT NULL,
        "parsed_command" character varying,
        "status" "public"."whatsapp_event_status_enum" NOT NULL DEFAULT 'received',
        "processed_at" TIMESTAMP,
        CONSTRAINT "PK_whatsapp_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_whatsapp_events_provider_message_id" UNIQUE ("provider_message_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_events_provider_message_id" ON "whatsapp_events" ("provider_message_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_events_from_number_created_at" ON "whatsapp_events" ("from_number", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_events_direction_created_at" ON "whatsapp_events" ("direction", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "whatsapp_ai_contexts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "event_id" uuid NOT NULL,
        "provider" character varying(32) NOT NULL,
        "model" character varying(128),
        "input_text" text NOT NULL,
        "reply_text" text NOT NULL,
        "metadata" jsonb,
        "expires_at" TIMESTAMP,
        CONSTRAINT "PK_whatsapp_ai_contexts_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_whatsapp_ai_contexts_event" FOREIGN KEY ("event_id") REFERENCES "whatsapp_events"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_ai_contexts_event_id" ON "whatsapp_ai_contexts" ("event_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_ai_contexts_expires_at" ON "whatsapp_ai_contexts" ("expires_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "occurred_at" TIMESTAMP NOT NULL,
        "account_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "direction" "public"."transaction_direction_enum" NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "description" character varying,
        "source" "public"."transaction_source_enum" NOT NULL DEFAULT 'web',
        "locked_until" TIMESTAMP,
        "whatsapp_event_id" uuid,
        CONSTRAINT "PK_transactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transactions_account_id" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_transactions_category_id" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_transactions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_transactions_whatsapp_event_id" FOREIGN KEY ("whatsapp_event_id") REFERENCES "whatsapp_events"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_occurred_at" ON "transactions" ("occurred_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_user_id_occurred_at" ON "transactions" ("user_id", "occurred_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_account_id" ON "transactions" ("account_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_category_id" ON "transactions" ("category_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_whatsapp_event_id" ON "transactions" ("whatsapp_event_id") WHERE "whatsapp_event_id" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "transaction_id" uuid NOT NULL,
        "file_name" character varying NOT NULL,
        "mime_type" character varying NOT NULL,
        "storage_path" character varying NOT NULL,
        CONSTRAINT "PK_attachments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_attachments_transaction_id" UNIQUE ("transaction_id"),
        CONSTRAINT "FK_attachments_transaction_id" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "transaction_audit" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "transaction_id" uuid NOT NULL,
        "changed_by" uuid,
        "changed_at" TIMESTAMP NOT NULL,
        "old_values" jsonb,
        "new_values" jsonb,
        "reason" character varying,
        CONSTRAINT "PK_transaction_audit_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transaction_audit_transaction_id" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_transaction_audit_changed_by" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "projections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "scope_user_id" uuid,
        "projected_income" numeric(12,2) NOT NULL,
        "projected_expense" numeric(12,2) NOT NULL,
        "projected_balance" numeric(12,2) NOT NULL,
        "trend" "public"."projection_trend_enum" NOT NULL DEFAULT 'flat',
        "generated_at" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_projections_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_projections_scope_user" FOREIGN KEY ("scope_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_projections_period_start" ON "projections" ("period_start")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_projections_scope_user" ON "projections" ("scope_user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "category_budgets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "category_id" uuid NOT NULL,
        "scope_user_id" uuid,
        "period" character varying(7) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        CONSTRAINT "PK_category_budgets_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_category_budgets_category_id" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_category_budgets_scope_user" FOREIGN KEY ("scope_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_category_budgets_all" ON "category_budgets" ("period", "category_id")
      WHERE "scope_user_id" IS NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_category_budgets_user" ON "category_budgets" ("period", "category_id", "scope_user_id")
      WHERE "scope_user_id" IS NOT NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_category_budgets_scope_user_period" ON "category_budgets" ("scope_user_id", "period")`,
    );

    await queryRunner.query(`
      CREATE TABLE "monthly_budgets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "scope_user_id" uuid,
        "period" character varying(7) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "estimated_average_income" numeric(12,2),
        CONSTRAINT "PK_monthly_budgets_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_monthly_budgets_scope_user" FOREIGN KEY ("scope_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_monthly_budgets_all" ON "monthly_budgets" ("period")
      WHERE "scope_user_id" IS NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_monthly_budgets_user" ON "monthly_budgets" ("period", "scope_user_id")
      WHERE "scope_user_id" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "user_ai_contexts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "user_id" uuid NOT NULL,
        "role" character varying(16) NOT NULL,
        "content" text NOT NULL,
        "tool_call_id" character varying(64),
        "name" character varying(128),
        "metadata" jsonb,
        CONSTRAINT "PK_user_ai_contexts_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_ai_contexts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_user_ai_contexts_user_id" ON "user_ai_contexts" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "investment_instruments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "symbol" character varying(32) NOT NULL,
        "market" "public"."investment_market_enum" NOT NULL,
        "kind" "public"."investment_instrument_kind_enum" NOT NULL DEFAULT 'stock',
        "currency" character varying(8) NOT NULL DEFAULT 'BRL',
        "display_name" character varying(128),
        "quote_symbol" character varying(64),
        CONSTRAINT "PK_investment_instruments_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_investment_instruments_symbol_market"
      ON "investment_instruments" ("symbol", "market")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_investment_instruments_market" ON "investment_instruments" ("market")`,
    );

    await queryRunner.query(`
      CREATE TABLE "investment_movements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "user_id" uuid NOT NULL,
        "instrument_id" uuid NOT NULL,
        "kind" "public"."investment_movement_kind_enum" NOT NULL,
        "quantity" numeric(24, 8) NOT NULL DEFAULT 0,
        "unit_price" numeric(24, 8) NOT NULL DEFAULT 0,
        "fees" numeric(24, 8) NOT NULL DEFAULT 0,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "notes" character varying(512),
        CONSTRAINT "PK_investment_movements_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_investment_movements_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_investment_movements_instrument" FOREIGN KEY ("instrument_id") REFERENCES "investment_instruments"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_investment_movements_user_id" ON "investment_movements" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_investment_movements_instrument_id" ON "investment_movements" ("instrument_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_investment_movements_occurred_at" ON "investment_movements" ("occurred_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "investment_quote_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "instrument_id" uuid NOT NULL,
        "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "last_price" numeric(24, 8) NOT NULL,
        "currency" character varying(8) NOT NULL,
        "source" character varying(32) NOT NULL,
        CONSTRAINT "PK_investment_quote_snapshots_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_investment_quote_snapshots_instrument" FOREIGN KEY ("instrument_id") REFERENCES "investment_instruments"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_investment_quote_snapshots_instrument_recorded" ON "investment_quote_snapshots" ("instrument_id", "recorded_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "rag_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "source_key" character varying NOT NULL,
        "owner_user_id" uuid,
        "title" character varying,
        "content_hash" character varying NOT NULL,
        "metadata" jsonb,
        CONSTRAINT "PK_rag_documents_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rag_documents_owner_user" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_rag_documents_owner_user_id" ON "rag_documents" ("owner_user_id")`,
    );
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

    await queryRunner.query(`
      CREATE TABLE "rag_chunks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "document_id" uuid NOT NULL,
        "chunk_index" integer NOT NULL,
        "content" text NOT NULL,
        "metadata" jsonb,
        "embedding" vector(1536) NOT NULL,
        CONSTRAINT "PK_rag_chunks_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rag_chunks_document" FOREIGN KEY ("document_id") REFERENCES "rag_documents"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_rag_chunks_document_id" ON "rag_chunks" ("document_id")`,
    );

    await queryRunner.query(`
      CREATE INDEX "IDX_rag_chunks_embedding_hnsw" ON "rag_chunks"
      USING hnsw ("embedding" vector_cosine_ops)
    `);

    await queryRunner.query(`
      CREATE TABLE "ai_conversation_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "user_id" uuid NOT NULL,
        "channel" "public"."ai_channel_enum" NOT NULL,
        "session_date" date NOT NULL,
        "metadata" jsonb,
        CONSTRAINT "PK_ai_conversation_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_conversation_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_ai_session_user_channel_date" UNIQUE ("user_id", "channel", "session_date")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_ai_conversation_sessions_user_id" ON "ai_conversation_sessions" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "ai_agent_traces" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "session_id" uuid NOT NULL,
        "whatsapp_event_id" uuid,
        "status" "public"."ai_trace_status_enum" NOT NULL DEFAULT 'running',
        "provider" character varying(32),
        "model" character varying(128),
        "usage" jsonb,
        "error_message" text,
        "final_reply" text,
        "started_at" TIMESTAMP NOT NULL DEFAULT now(),
        "finished_at" TIMESTAMP,
        CONSTRAINT "PK_ai_agent_traces_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_agent_traces_session" FOREIGN KEY ("session_id") REFERENCES "ai_conversation_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ai_agent_traces_whatsapp_event" FOREIGN KEY ("whatsapp_event_id") REFERENCES "whatsapp_events"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_ai_agent_traces_session_id" ON "ai_agent_traces" ("session_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_agent_traces_whatsapp_event_id" ON "ai_agent_traces" ("whatsapp_event_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "ai_trace_observations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "trace_id" uuid NOT NULL,
        "sequence" integer NOT NULL,
        "observation_type" "public"."ai_observation_type_enum" NOT NULL,
        "name" character varying(256),
        "payload" jsonb NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_ai_trace_observations_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_trace_observations_trace" FOREIGN KEY ("trace_id") REFERENCES "ai_agent_traces"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_ai_trace_observations_trace_seq" ON "ai_trace_observations" ("trace_id", "sequence")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_trace_observations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_agent_traces"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_conversation_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "investment_quote_snapshots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "investment_movements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "investment_instruments"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."investment_movement_kind_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."investment_instrument_kind_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."investment_market_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rag_chunks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rag_documents"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."ai_observation_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."ai_trace_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."ai_channel_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "user_ai_contexts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "monthly_budgets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "category_budgets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transaction_audit"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_ai_contexts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "settings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "accounts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "public"."whatsapp_event_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."whatsapp_event_direction_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."whatsapp_sessions_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."projection_trend_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."transaction_source_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."transaction_direction_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."category_type_enum"`);

    await queryRunner.query(`DROP EXTENSION IF EXISTS vector`);
  }
}
