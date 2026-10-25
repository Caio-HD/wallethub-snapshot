# Arquitetura do Sistema

Este documento descreve a arquitetura geral do WalletHub, seus componentes principais, modelo de dados e fluxos.

## Arquitetura Geral

### Componentes Principais

- **Proxy (Traefik)**: terminação TLS automática (Let's Encrypt HTTP-01), middlewares de segurança, cache de static assets e roteamento para API, frontend e webhook.
- **API NestJS** (`apps/api`): exposta em `/api`, conecta-se ao PostgreSQL e Redis, publica/consome filas BullMQ.
- **Worker WhatsApp**: consome filas `whatsapp-*`, normaliza comandos recebidos e emite respostas via Baileys.
- **Worker Telegram**: consome filas `telegram-*`, partilha lógica de comandos/IA com WhatsApp; envia respostas via Bot API (`sendMessage`).
- **Frontend React** (`apps/web`): build estático servido por Nginx embutido na imagem (exposto ao Traefik).
- **Banco de Dados**: PostgreSQL com volume persistente `db_data`.
- **Redis**: suporte às filas BullMQ, tokens de refresh e locks.

Rede única `wallethub_net` com volumes: `db_data`, `redis_data`, `backups`.

## Backend

### Módulos principais

- `Organizations`: lista as organizações do utilizador autenticado (via `organization_memberships`); `PATCH /organizations/current` permite renomear o espaço activo (papéis `owner`/`admin` na membership, não o `role` global do utilizador). **`GET /organizations/current/members`** e **`PATCH /organizations/current/members/:userId/messaging-ai`** (owner/admin): vagas de IA para membros com papel `member` (`messaging_ai_enabled`); owners e admins usam IA sem ocupar vaga. Limites por plano em `messagingAiMemberSeatLimit` (`plan-capabilities.ts`). A organização activa em cada pedido vem do cabeçalho `X-Organization-Id` (UUID) ou, quando só existe uma org, dessa org; rotas protegidas com `ActiveOrganizationGuard` combinam JWT + membership. Novos utilizadores recebem organização pessoal + membership `owner` via `OrganizationsProvisioningService` (invocado no fluxo de emissão de tokens). Campos opcionais B2B em `organizations`: `legal_name`, `tax_id_type` (`cpf`/`cnpj`), `tax_id` (único quando preenchido).
- `Notion`: sync bidireccional opcional; criação/atualização a partir do webhook resolve `organization_id` com `resolveNotionSyncOrganizationId` (uma org na base → automático; várias orgs → variável de ambiente `NOTION_SYNC_ORGANIZATION_ID`). Saldos de conta no sync usam transacções filtradas por `organization_id`.
- `Plan / entitlements`: plano (`free`, `pro`, `plus`) persistido na organização; `EntitlementsService` centraliza capacidades (ex.: import de extrato na web, quotas mensais de IA **Web + WhatsApp + Telegram**, vagas de IA para membros) para evitar `if (plan)` espalhado pelos controladores.
- `Auth`: login, refresh token armazenado no Redis, rate limiting de 5 tentativas/min.
- `Users`: leitura/atualização de perfil; `GET /users/active` está limitado à organização activa (guard + membership). Papel global JWT: `admin` (operador da app) ou `super_admin` (rotas `/admin/*` e integrações de plataforma que listam toda a base).
- `Categories`, `Accounts`, `Transactions`: CRUD completo com filtros, auditoria (`transaction_audit`) e bloqueio de transações oriundas do WhatsApp ou Telegram por 2h. `CategorySuggestionService` sugere categoria por descrição com base no histórico (mesmo tipo receita/despesa), usado no preview de importação CSV.
- `Projections`: recalcula projeções por escopo (all/user1/user2) a partir de triggers das filas; núcleo partilhado `MonthlyCashflowForecastService` (orçamento + histórico ponderado). Saldo projectado negativo enfileira job `negative-balance` na fila `alerts`.
- `Alerts`: `AlertsProcessor` consome `alerts`, persiste `alert_events` (ex.: saldo negativo projectado). API **`GET /alerts`**, **`PATCH /alerts/:id/read`** (organização activa).
- `Reminders`: CRUD **`/reminders`** (lembretes por utilizador e org); cron diário (00:05 UTC) dispara alertas in-app `reminder_due` sem mensagens WhatsApp proactivas.
- `Debts`: CRUD **`/debts`** (dívidas parceladas org-scoped, admin-only); cronograma, pay/unpay/skip, pay-remaining, summary **`/debts/summary`**; alertas `debt_due_soon` (cron 00:15 UTC, fuso org via settings WhatsApp).
- `Budgets`: orçamento por categoria e orçamento mensal geral; CRUD em `/budgets/category` e `/budgets/monthly`; dashboard summary inclui limites e percentual usado.
- `WhatsApp`: integração Baileys; eventos inbound enfileiram jobs; health em `/whatsapp/health`. Fornecedor de IA (rotas admin `GET/PUT /whatsapp/settings/ai-provider`) persiste em `settings` com **`organization_id`** (índice único por org + key); env opcional `WHATSAPP_AI_SETTINGS_ORGANIZATION_ID`; sem env válido usa-se a primeira organização por data de criação.
- `Telegram`: Bot API com `POST /telegram/webhook/:pathToken`; apenas DM; emparelhamento via `POST /telegram/link-code` (JWT) + `/start <nonce>`; health/config em `/telegram/health` e `/telegram/config` (**`super_admin`**). IA e comandos partilham `WalletInboundMessagingModule` com WhatsApp.

### Endpoints (prefixo `/api`)

`/auth/login`, `/auth/refresh`, `/auth/logout`, `/users/me`, **`GET /organizations`** (lista do utilizador), **`PATCH /organizations/current`** (nome do espaço activo; membership `owner`/`admin`), **`GET /organizations/current/members`**, **`PATCH /organizations/current/members/:userId/messaging-ai`** (vagas IA; owner/admin), `/categories`, `/accounts`, `/transactions`, `/dashboard/summary`, `/dashboard/categories-report`, `/dashboard/evolution` (query: `months` legado; ou `anchor` + `pastMonths` + `futureMonths`; ou `periods` CSV de `yyyy-MM` até 36 meses — quando presente, ignora âncora/janela; resposta com `rowKind` por mês), `/dashboard/export/csv`, `/dashboard/projections`, `/dashboard/recalculate`, `/budgets/category` (GET/PUT/DELETE), `/budgets/monthly` (GET/PUT), **`/debts`** (CRUD + pay/unpay/skip/pay-remaining + summary), **`GET /users/active`** (membros da organização activa; requer papel global JWT `admin` ou `super_admin`), **`GET /alerts`**, **`PATCH /alerts/:id/read`**, **`/reminders`** (CRUD), **`/imports/statement`**, **`/imports/statement/preview`** (multipart; campo opcional `defaultCategoryId` para sugestões), **`/imports/statement/commit`** (multipart; `dryRun`; opcional `categoryOverrides` JSON por índice de linha), `/whatsapp/webhook`, `/whatsapp/health`, **`/whatsapp/settings/ai-provider`** (admin), **`/telegram/webhook/:pathToken`**, **`/telegram/health`**, **`/telegram/config`**, **`/telegram/link-code`**, `/backup/success`, `/attachments` (upload/download/delete), `/health`.

Pedidos autenticados que operam dados partilhados da org devem enviar **`X-Organization-Id`** com o UUID da organização (o cliente web configura-o automaticamente quando há org seleccionada). Sem cabeçalho, utilizadores com uma única org podem ser resolvidos automaticamente; com várias orgs, o cabeçalho é obrigatório onde o guard está activo.

### Filas BullMQ

- `whatsapp-inbound`
- `whatsapp-outbound`
- `telegram-inbound`
- `telegram-outbound`
- `projections`
- `alerts`

### Observabilidade e Segurança

- Logging com `nestjs-pino`.
- Métricas Prometheus em `/metrics`.
- Health check agregando API, banco, Redis e filas.
- JWT RS256 (chaves via env), segredos nunca versionados; o access token carrega `role` e
  `isMfaEnabled`.
- **RBAC e isolamento multi-tenant:**
  - `RolesGuard` — hierarquia: `super_admin` (operador de plataforma) satisfaz qualquer `@Roles(...)`;
    demais papéis fazem match exato. Todo usuário comum tem role global `admin`.
  - `ActiveOrganizationGuard` + `@ActiveOrganization()` — **único portão** de escopo de dados por
    organização para controllers org-scoped (passam `org.id` aos serviços). O teste arquitetural
    `tests/unit/tenant-isolation.arch.spec.ts` falha o CI se um controller org-scoped perder o guard.
  - `ElevatedAccessService` / `ElevatedAccessGuard` (`common/security/`) — fonte única de verdade do
    poder elevado do `super_admin`: kill-switch `SUPER_ADMIN_BYPASS_ENABLED` + pré-condição de MFA.
    Consumido pelas rotas de plataforma e pelo bypass de impersonation em `OrganizationsService`.
  - **Impersonation:** `super_admin` (elevado) resolve qualquer org via `X-Organization-Id` sem
    membership; o contexto fica marcado `impersonated: true`. Detalhes operacionais em
    `ops/paas/PLATFORM-SECURITY.md`.

## Frontend

- Vite + React 18 + Tailwind (`@tailwindcss/forms`).
- Contexto de autenticação com refresh automático (axios interceptor).
- Contexto de **organização activa** (`ActiveOrganizationProvider`): selector no layout autenticado; o cliente API inclui `X-Organization-Id` nas mutações e leituras; `refreshOrganizations()` revalida a lista após alterações (ex.: nome do espaço em Perfil); hooks React Query usam o id da org na `queryKey` para não misturar caches entre organizações.
- Rotas protegidas (`/dashboard`, `/entries`) e públicas (`/login`).
- Componentes: `KpiCard`, `GlobalUserSelector` (filtro de vista no dashboard por membro da organização activa vs. «Todos», alimentado por `GET /users/active`), `PeriodPicker`, `CashflowTimelineChart`, `EvolutionChart` (investimentos), `TransactionsTable`, `WhatsAppStatusBanner`.
- Hooks React Query para `dashboard`, `transactions`, `categories`, `accounts`, `whatsapp`, `telegram`.
- Env vars: `VITE_API_URL`, `VITE_WHATSAPP_STATUS_POLL` (opcional).

## Modelo de Dados (PostgreSQL)

### Tabelas Principais

- `organizations`: nome, `plan` (`free`/`pro`/`plus`), `legal_name`, `tax_id_type`, `tax_id` (opcionais), timestamps.
- `organization_memberships`: `organization_id`, `user_id`, `role` (`owner`/`admin`/`member`), `status` (`active`/`invited`), `messaging_ai_enabled` (vagas IA para papel `member`); unicidade `(organization_id, user_id)`.
- `users`: `role` global `admin` ou `super_admin`; `phone_number` obrigatório para WhatsApp onde aplicável; `telegram_user_id` opcional após ligação ao bot.
- `categories`: `type` (`income`/`expense`), `organization_id`, `owner_scope` (`all`/`user1`/`user2`), reordenação por `sort_order`; unicidade de nome por organização onde aplicável.
- `accounts`: controle de saldos por escopo; **`organization_id`**; nomes únicos por organização.
- `transactions`: direção derivada da categoria, `source` (`web`/`whatsapp`/`telegram`), auditoria em `transaction_audit`; **`organization_id`**.
- `attachments`: metadados de arquivos (armazenados externamente).
- `projections`: receita/despesa projetadas (orçamento + fallback histórico); alerta se saldo mensal projetado < 0.
- `alert_events`: alertas in-app por organização (`type` `negative_balance` | `reminder_due` | `whatsapp_disconnected` | `debt_due_soon`, `user_id` opcional, `read_at`).
- `reminders`: lembretes (`due_at`, `recurrence` `none`|`monthly`, `completed_at`, `last_fired_at`).
- `debts`: obrigações parceladas (`principal_amount`, `installment_amount`, `total_installments`, `start_date`, `category_id`, `account_id`); org-scoped; status `active`|`paid_off`|`paused`.
- `debt_installments`: cronograma (`due_date` DATE, `amount`, `status` `pending`|`paid`|`skipped`, `transaction_id` opcional).
- `category_budgets`: limite de gasto por categoria, por escopo, por mês (period yyyy-MM).
- `monthly_budgets`: teto total de despesa por escopo por mês.
- `whatsapp_events`: deduplicação por `provider_message_id`, histórico inbound/outbound.
- `telegram_events`: deduplicação por `provider_message_id`, payload e estado por organização.
- `telegram_link_nonces`: nonces temporários para emparelhamento conta WalletHub ↔ Telegram.
- `settings`: JSON por chave; **`organization_id`** obrigatório; escopo opcional por utilizador (`scope_user_id`); chaves globais da org (ex.: `whatsapp_ai_provider`) usam `scope_user_id` nulo.
- `rag_documents`: metadados de ingestão RAG; **`organization_id`** para documentos do tenant (combina com `owner_user_id` onde aplicável); entradas globais da plataforma podem usar `organization_id` nulo (gestão `super_admin`).

### Relacionamentos

- `organizations` 1:N `organization_memberships`; `users` N:N `organizations` via memberships.
- `organizations` 1:N `accounts`, `categories`, `transactions` (e demais entidades com `organization_id` no agregado financeiro).
- `users` 1:N `transactions` (autor / dono do registo, conforme modelo actual)
- `categories` 1:N `transactions`
- `transactions` 1:1 `attachments`
- `whatsapp_events` 1:N `transactions`
- `telegram_events` 1:N `transactions`

## Fluxos Principais

1. **Lançamento via Dashboard**: usuário → API → PostgreSQL → BullMQ para projeções.
2. **Lançamento via WhatsApp**: webhook → valida assinatura → enfileira evento → worker processa → registra transação → envia resposta → atualiza projeções.
3. **Lançamento via Telegram**: webhook Bot API → valida path/secret → persiste `telegram_events` → fila inbound → worker partilhado → transação/resposta → projeções.
4. **Dashboards**: frontend consome `/dashboard/summary`, `/dashboard/evolution` (parâmetros derivados do `PeriodPicker` via `evolutionParamsFromDashboardPeriod`: um único `yyyy-MM` → janela `anchor` + `pastMonths` = `DASHBOARD_EVOLUTION_SINGLE_ANCHOR_PAST_MONTHS` (5) + `futureMonths` 0, ou seja 6 meses contíguos até à âncora; dois ou mais meses → query `periods` com lista ordenada, podendo ser não consecutivos; realizado vs projetado por mês) e opcionalmente `/dashboard/projections` (último snapshot do job); KPIs e categorias vêm do resumo e relatórios. O gráfico de fluxo mensal escala em largura com scroll horizontal.
5. **Importação de extrato (CSV)**: Web envia ficheiro para `/imports/statement/*` com conta e categoria por defeito; preview pode incluir `defaultCategoryId` para sugestões heurísticas por linha (`CategorySuggestionService`); commit aceita `categoryOverrides` por índice. O mesmo `StatementImportService` processa CSV enviado pelo WhatsApp (documento com legenda contendo dois UUIDs: conta e categoria), com gating `whatsappStatementImport` e contagem em `organization_usage_counters`.

## Dependências Cruzadas e Lacunas

- **Autenticação**: frontend depende de refresh automático; backend usa Redis dedicado para tokens.
- **Escopos (`owner_scope`)**: atualizar enums sincronizadamente em API e UI (filtros, dashboards, permissões).
- **Limite WhatsApp/Telegram (2h)**: UI deve impedir edição/remoção enquanto bloqueio ativo; API retorna `409` em violações.
- **Projeções e alertas**: filas BullMQ (`projections`, `alerts`) impactam dashboards e notificações; `AlertsProcessor` materializa `alert_events`; monitorar saúde do Redis.
- **Attachments**: ✅ Sistema completo implementado com suporte a storage local, S3 e MinIO. Endpoints: `POST /attachments` (upload), `GET /attachments/:id` (download), `DELETE /attachments/:id`, `POST /attachments/:id/associate/:transactionId`.
- **MFA TOTP**: previsto para futuros releases; necessário especificar fluxo e UX.
- **CI/CD**: ✅ Pipeline GitHub Actions implementado (`.github/workflows/ci.yml`) com cache otimizado e publish condicional de imagens Docker.

## Anexos WhatsApp

Para detalhes da integração WhatsApp (Baileys, compliance, IA, observabilidade, persistência, PostgreSQL, segredos), consulte a [documentação WhatsApp](whatsapp.md).

## Anexos Telegram

Para a integração Telegram Bot API (webhook, filas, emparelhamento, quotas IA partilhadas), consulte a [documentação Telegram](telegram.md).

---

**Ver também**: [Desenvolvimento](desenvolvimento.md) | [CLI e Workflows](cli-workflows.md) | [Deploy e Operações](deploy-operacoes.md)

