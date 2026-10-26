# ADR — Zenrick Connector: ingestão S2S de extratos e integração ao ecossistema Zenrick

- **Status:** Accepted
- **Data:** 2026-07-02
- **Decisor:** operador (ricknya), sessão 2026-07-02; arquitetura selecionada por painel
  comparativo de 3 propostas (event-driven via NexusCore × S2S mínimo × módulo de plataforma).
- **Contexto:** O WalletHub passa a ser **módulo do ecossistema Zenrick** (Kyron, NexusCore,
  QA Platform), não app isolado. Pipeline-alvo: Kyron lê e-mails financeiros → baixa anexo
  OFX → sobe no WalletHub → categorização automática → relatório narrado pelo Kyron no
  WhatsApp do operador. Este ADR promove a análise exploratória
  [wallethub-connector-exploration.md](../design/wallethub-connector-exploration.md) (PR #102)
  a decisão, resolvendo as questões que ela deixou em aberto. O ADR-espelho no Kyron é o
  `Caio-HD/Kyron docs/adr/0030-wallethub-module.md`.

## Decisão

### 1. Transporte: S2S direto, NexusCore fora do caminho de dados

O Kyron chama a API do WalletHub **diretamente** (HTTPS S2S). O NexusCore recebe apenas
**eventos de auditoria** (`record_event`) — nunca atua como barramento nem transporta o
arquivo. Motivos verificados: a entrega de eventos do NexusCore é 100% pull (sem webhook,
subscription ou consumer offset) e o MinIO de artifacts não tem endpoint público; usar o
NexusCore como bus exigiria um poller com cursor no WalletHub — a mesma classe de mecanismo
que causou o incidente de reflood do Kyron (#146).

### 2. Quem parseia: o WalletHub

O Kyron detecta, baixa e **entrega o arquivo bruto** (OFX/CSV, base64). O parse é do
`StatementImportService` existente — parser OFX maduro com charset BR, resolução de conta
via `BANKACCTFROM`, lote auditável e dedup em camadas (ver §5). Fonte única de parse (DRY);
o Kyron nunca reimplementa extração de transações.

### 3. Contrato v1

```
POST /api/integrations/zenrick/statements
Authorization: Bearer <WALLETHUB_CONNECTOR_TOKEN>
Idempotency-Key: sha256(gmailMessageId + ':' + attachmentId)   # obrigatório; 400 sem ele
Content-Type: application/json
```

```json
{
  "schemaVersion": 1,
  "organizationId": "<uuid>",
  "file": { "format": "ofx|csv", "filename": "extrato.ofx", "contentBase64": "...", "sha256": "<hex>" },
  "routing": { "accountId": null, "ensureAccount": true, "defaultCategoryId": null,
               "incomeCategoryId": null, "expenseCategoryId": null },
  "options": { "dryRun": false },
  "provenance": { "channel": "email", "extractor": "kyron/google-connector@<versão>",
                  "messageIdHash": "sha256:<...>", "receivedAt": "<ISO8601>", "confidence": 1.0 }
}
```

Resposta 200 (replay idempotente devolve a mesma):
`{ schemaVersion, batchId, accountId, created, skipped, alreadyExists, uncategorized, reconciliation, bankInfo, uncategorizedLines[] }`.
Erros: 401 token · 403 org fora da allowlist/capability · 409 `file_hash` duplicado (lote
vivo; o cliente trata como **sucesso idempotente**) · 422 schema/formato · 400 major de
`schemaVersion` desconhecido.

Versionamento: mudanças aditivas mantêm `schemaVersion: 1`; breaking → `2` com a rota
aceitando ambos por 1 ciclo. Contrato exposto no OpenAPI/Swagger existente.

**Proveniência:** migration aditiva em `statement_import_batches` → colunas `origin` text
(`'connector'`) e `provenance` jsonb (extractor, `messageIdHash`, receivedAt).
**Nunca** persistir/logar remetente, assunto ou corpo do e-mail (LGPD).

### 4. Autenticação e autorização

- **v1:** token dedicado `WALLETHUB_CONNECTOR_TOKEN` + `ConnectorTokenGuard` (clone do
  `AdminTokenGuard`, comparação constant-time). **Não** reutilizar `WALLETHUB_ADMIN_TOKEN`
  (menor privilégio: comprometimento do connector não dá backup/QA). Org **explícita** no
  body, validada contra `WALLETHUB_CONNECTOR_ALLOWED_ORGS` (v1 = só a org do operador).
  `user_id` das transações = owner da org (precedente `qa-admin.controller`). ThrottlerGuard
  no controller. Rotação do token entra no runbook de secret rotation **desde a Fase 1**
  (gap conhecido: chave do render-ruleset ficou fora do runbook).
- **Alvo (Fase 6):** tabela `integration_clients` (token argon2, org binding, scopes
  `statements:write`/`reports:read`/`mcp`, revogação, `last_used_at`) — 1 client por
  integração (kyron, qa-platform), rotação sem redeploy.

### 5. Idempotência e deduplicação (4 camadas)

1. **HTTP replay** — `Idempotency-Key` estável + `StatementImportIdempotencyService`
   (Redis, TTL 24h) devolve a mesma resposta; **ledger durável** em Postgres
   (`connector_ingest_events`: idempotency_key UNIQUE, status, attempts, last_error,
   batch_id) dá replay determinístico pós-TTL, DLQ lógico e trilha "o que aconteceu com o
   e-mail X?".
2. **Lote** — `statement_import_batches.file_hash` único parcial → 409 em reimport.
3. **Transação** — `external_id` (FITID normalizado; CSV sem FITID → sintético
   determinístico `email:<messageIdHash>:<n>`) + reconciliação ±3 dias existente.
4. **Fonte** — pós-2xx/409 o Kyron aplica label Gmail `Zenrick/WalletHub-ingested`.
   Eventos NexusCore são auditoria, **nunca** mecanismo de dedup.

Rollback de ingestão errada: exclusão em bloco do lote (já existente).

### 6. `source = 'connector'` e comportamento de commit

- Migration `ALTER TYPE transaction_source_enum ADD VALUE IF NOT EXISTS 'connector'`,
  aplicada **antes** do código que a usa (PG não permite usar o valor na mesma transação;
  o gate de deploy não roda migrations no boot → deploy da Fase 1 tem 2 passos ordenados).
- `importCsvFromWeb` ganha parâmetro `source` (hoje hardcoded `'web'`).
- **Auto-commit** para OFX (dedup blindado + rollback por lote); `options.dryRun` disponível
  e usado no primeiro ciclo E2E supervisionado. **Sem** `locked_until` (lock de 2h é
  semântica dos canais de mensageria, não do connector).
- Recalculo de projeções: **1 job por lote** (debounce), não por transação — cobrir com
  testes os dois fluxos (web e connector), pois o caminho é compartilhado.

### 7. Plano comercial

v1 **sem** gating de plano — só a allowlist de org. `PlanCapability
connectorStatementImport` entra na produtização (Fase 6). Elimina o modo de falha
403-por-entitlement no E2E do operador.

### 8. Categorização: learning loop como motor; Kyron como enriquecedor (v2)

- **v1 (vivo em prod):** precedência do ADR de
  [categorização](adr-categorization-learning-loop.md) — override >
  `statement_category_mappings` > default direcional > "Sem categoria" de sistema.
  `CategorySuggestionService` (heurístico, não-LLM) **permanece** — não confundir com a IA
  aposentada (§10).
- **v2 (Fase 4):** a resposta do commit devolve `uncategorizedLines`; o Kyron classifica
  via LLM contra as categorias da org (`GET /api/integrations/zenrick/categories`) e aplica
  via `POST /api/integrations/zenrick/statements/:batchId/categorize` com proveniência
  `suggested_by: 'kyron'` + confidence. A sugestão do Kyron **não** alimenta
  `statement_category_mappings` — só a confirmação/edição humana alimenta (evita loop de
  ruído LLM→mapping→relatório).
- **LGPD (decisão do operador, 2026-07-02):** as descrições de transações podem trafegar
  pela cadeia LLM padrão do Kyron (primário DeepSeek) — **consentimento explícito do
  operador registrado aqui**; escopo = org do operador (single-tenant do pipeline). Se o
  connector for produtizado para tenants terceiros, essa decisão **não se estende**: exigirá
  avaliação de subprocessador/residência de dados própria. Descrições nunca entram em logs
  nem em eventos NexusCore.

### 9. Relatórios: WalletHub gera dados, Kyron compõe e entrega

- Superfície S2S read-only (Fase 3): `GET /api/integrations/zenrick/reports/`
  `summary|categories|evolution|top-transactions` + `GET .../categories`, controllers finos
  com `ConnectorTokenGuard` + `organizationId`, reusando `DashboardService`/`DateRangePipe`.
- O Kyron narra e entrega via OperatorDigest/WhatsApp (**single-voice**: só o Kyron fala com
  o operador). O scaffold de digest diário do WalletHub fica congelado; se um dia for
  implementado, é feature de **tenant** (canal de produto), nunca do operador — evita
  mensagem duplicada.
- Relatório v1 expõe `uncategorized` como call-to-action ("N lançamentos sem categoria —
  recategorize para eu aprender"): o cold-start é real (histórico Nubank já importado com
  categorização pobre) e alimenta o learning loop.

### 10. Aposentadoria da IA/RAG próprios ("Kyron é a IA do WalletHub")

Fato verificado: o stack IA/RAG interno (`modules/ai/` — agente com tool-calling e 4
providers; `modules/rag/` — pgvector, embeddings OpenAI; UI Wallet Assistant e
PlatformRagTab) está **morto em prod** desde sempre (`OPENAI_API_KEY` vazio →
`rag.enabled=false`, `runAgent` retorna null). Decisão em 3 estágios, código-antes-de-schema:

- **R1 (Fase 5a):** ADR próprio (`adr-retire-internal-ai-rag.md`); esconder `/ai` e
  PlatformRagTab; `/api/ai/*` → 410 atrás de flag; verificar em prod que as tabelas AI/RAG
  estão vazias (se houver dados: exportar/decidir com o operador antes — LGPD); reescrever a
  seção "IA e RAG" do roadmap (Jina/Ollama/EmbeddingProvider = descartados).
- **R2 (Fase 5b):** **antes de deletar, portar `ai-tools.definitions.ts` + executor** para
  `integrations/zenrick` (base das tools do futuro MCP server — único ativo valioso do
  módulo); deletar `modules/ai/`, `modules/rag/`, `mcp-client.service` (a direção inverte:
  o WalletHub vira MCP **server**, não client), UI, dep `openai`, envs `AI_*`/RAG.
  Fallback conversacional WhatsApp/Telegram vira mensagem de ajuda determinística.
- **Capability comercial (decisão do operador, 2026-07-02):** `aiMessagingAssistant*` e
  seats ficam **deprecated**, com reoferta futura registrada no roadmap como
  **"Kyron-per-tenant"** (IA para tenants SaaS servida pelo Kyron), fora do escopo deste épico.
- **R3 (Fase 6, opcional/gated):** drop das 6 tabelas AI/RAG + extensão `vector` em
  migration nova com rollback DDL documentado, `ALLOW_DESTRUCTIVE_MIGRATION` one-shot e
  aprovação humana explícita. Pode adiar indefinidamente (política de não-exclusão vence).

### 11. Segurança e modos de falha (obrigações de implementação)

- **Anti-spoofing:** e-mail forjado com OFX é vetor de escrita no sistema financeiro.
  Mitigações v1: allowlist de org + dedup + rollback por lote + `dryRun` supervisionado no
  primeiro ciclo; o braço do Kyron valida remetente/metadata antes de promover candidato
  (detalhe no ADR-0029 do Kyron). Alerta de origem anômala no digest.
- **Watchdog de silêncio:** OAuth expirado, quota, flag OFF ou falso negativo do
  classificador param o pipeline **sem erro** — detector no scheduler do Kyron alerta
  "nenhum extrato ingerido em N dias".
- **Falhas estruturadas:** além do evento de sucesso `WALLETHUB_STATEMENT_INGESTED`, evento
  `FINANCE_PIPELINE_ERROR {stage: detect|download|upload|import|deliver, code, attempts}`
  (sem PII) no NexusCore; falha persistente entra no digest narrado.
- **NexusCore advisory:** falha/timeout de `record_event` **nunca** bloqueia ingestão nem
  narração (try/log/continue); prever LEASE_ENFORCE futuro (403 → retry + degradação).
- **Observabilidade:** métricas Prometheus `wallethub_connector_ingest_total{status}` +
  duração, logs estruturados sem PII, `GET /api/health/connector`.
- **Escala:** se OFX grande estourar o request síncrono, mover para fila interna (padrão
  `whatsapp-inbound`) devolvendo 202 + poll do batch, com o **mesmo** payload v1.

## Alternativas rejeitadas

1. **NexusCore como barramento (event-driven puro):** melhor superfície de ataque (zero
   endpoint inbound), mas exige poller custom com cursor no WalletHub (entrega é pull-only,
   sem ack/offset no servidor) e MinIO não é alcançável cross-network — reintroduz a classe
   de bug do reflood. Enxertos absorvidos: ledger durável, taxonomia de erros, watchdog.
2. **Kyron parseia o OFX e envia transações JSON:** duplicaria parser/dedup que já são
   maduros no WalletHub (viola DRY) e moveria a responsabilidade de consistência financeira
   para fora do sistema de registro.
3. **Reutilizar `WALLETHUB_ADMIN_TOKEN` ou `source='web'`:** menos código, mas viola menor
   privilégio e perde proveniência/rastreabilidade.

## Fases (roadmap do épico)

| Fase | Escopo | Repos |
|------|--------|-------|
| 0 | Este ADR + ADR-0029 no Kyron + registro NexusCore | docs |
| 1 | Migrations (enum `connector`, proveniência, ledger) + módulo `integrations/zenrick` + testes — deployável dormante | WalletHub |
| 2 | Gmail-anexo + `WalletHubClient` + executor (flag OFF→ON, 1º ciclo dryRun) | Kyron |
| 3 | Endpoints de relatório S2S + digest financeiro narrado | WalletHub + Kyron |
| 4 | Categorização assistida (gated: só se o learning loop estagnar) | WalletHub + Kyron |
| 5 | Aposentadoria IA/RAG (R1 + R2, PRs separados) | WalletHub |
| 6 | MCP server + `integration_clients` + suíte QA Platform + R3 opcional | WalletHub + Kyron + QA |

Cada fase é deployável e reversível isoladamente (flag OFF / revert de PR / migrations
aditivas com rollback documentado).

## Referências

- [Análise exploratória do connector](../design/wallethub-connector-exploration.md) (PR #102)
- [ADR OFX import/auditoria](adr-ofx-import-audit.md) · [ADR categorização/learning loop](adr-categorization-learning-loop.md) · [ADR transferências](adr-transfer-type-and-fixed-income.md)
- Kyron: `docs/adr/0011` (brain-without-hands) · `0022` (Google connector) · `0030` (espelho deste ADR)
- NexusCore: eventos como auditoria (convenção DEPLOY 2026-06-13)
